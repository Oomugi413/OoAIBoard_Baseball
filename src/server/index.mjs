import http from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAction,
  createBoard,
  createDefaultSettings
} from "../shared/scoringRules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const clientDir = path.join(rootDir, "src", "client");
const storageDir = path.join(rootDir, "storage", "data");
const dataFile = path.join(storageDir, "app.json");
const DEFAULT_PORT = Number(process.env.PORT || 52582);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_PORT_ATTEMPTS = 20;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

const sseClients = new Set();
let state = await loadState();
cleanupIfIdle();
touchAccess();
await saveState();

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "サーバー内部でエラーが発生しました。" });
  }
});

const port = await listenWithFallback(server, DEFAULT_PORT);
console.log(`Baseball scoreboard server started`);
console.log(`Local:   http://localhost:${port}`);
console.log(`Network: http://<this-computer-ip>:${port}`);

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/events") {
    handleSse(req, res);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    cleanupIfIdle();
    touchAccess();
    await handleApi(req, res, url);
    await saveState();
    return;
  }

  await serveStatic(req, res, url);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicState());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    sendJson(res, 200, state.settings);
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/settings") {
    const body = await readJsonBody(req);
    state.settings = {
      ...state.settings,
      ...body,
      autoCleanupIdleHours: Math.max(1, Number(body.autoCleanupIdleHours || state.settings.autoCleanupIdleHours)),
      overlayDisplaySeconds: Math.max(1, Number(body.overlayDisplaySeconds || state.settings.overlayDisplaySeconds))
    };
    broadcast("settings changed", { settings: state.settings });
    sendJson(res, 200, state.settings);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/boards") {
    sendJson(res, 200, state.boards);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/boards") {
    const body = await readJsonBody(req);
    const board = createBoard(randomUUID(), body.name || `Scoreboard ${state.boards.length + 1}`);
    state.boards.push(board);
    broadcast("board created", { board });
    sendJson(res, 201, board);
    return;
  }

  const boardMatch = url.pathname.match(/^\/api\/boards\/([^/]+)(?:\/(action))?$/);
  if (boardMatch) {
    const boardId = decodeURIComponent(boardMatch[1]);
    const boardIndex = state.boards.findIndex((board) => board.id === boardId);
    if (boardIndex === -1) {
      sendJson(res, 404, { error: "スコアボードが見つかりません。" });
      return;
    }

    if (req.method === "GET" && !boardMatch[2]) {
      state.boards[boardIndex].lastAccessedAt = new Date().toISOString();
      sendJson(res, 200, state.boards[boardIndex]);
      return;
    }

    if (req.method === "POST" && boardMatch[2] === "action") {
      const body = await readJsonBody(req);
      const result = applyAction(state.boards[boardIndex], body, state.settings);
      if (result.error) {
        sendJson(res, 400, { error: result.error, board: result.board });
        return;
      }
      state.boards[boardIndex] = result.board;
      state.boards[boardIndex].lastAccessedAt = new Date().toISOString();
      if (result.changed) {
        broadcast("board state changed", { board: state.boards[boardIndex] });
      }
      sendJson(res, 200, state.boards[boardIndex]);
      return;
    }

    if (req.method === "DELETE" && !boardMatch[2]) {
      const [deleted] = state.boards.splice(boardIndex, 1);
      broadcast("board deleted", { boardId: deleted.id });
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  sendJson(res, 404, { error: "APIが見つかりません。" });
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const candidate = path.normalize(path.join(clientDir, pathname));
  if (!candidate.startsWith(clientDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const fileStat = await stat(candidate);
    if (!fileStat.isFile()) throw new Error("not a file");
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes.get(ext) || "application/octet-stream" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(candidate).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function handleSse(req, res) {
  cleanupIfIdle();
  touchAccess();
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: connected\ndata: ${JSON.stringify(publicState())}\n\n`);
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
}

function broadcast(type, payload) {
  const data = JSON.stringify({ type, payload, state: publicState() });
  for (const client of sseClients) {
    client.write(`event: update\ndata: ${data}\n\n`);
  }
}

async function loadState() {
  await mkdir(storageDir, { recursive: true });
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      boards: Array.isArray(parsed.boards) ? parsed.boards : [],
      settings: {
        ...createDefaultSettings(),
        ...(parsed.settings || {})
      },
      presets: Array.isArray(parsed.presets) ? parsed.presets : []
    };
  } catch {
    return {
      boards: [],
      settings: createDefaultSettings(),
      presets: []
    };
  }
}

async function saveState() {
  await mkdir(storageDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
}

function publicState() {
  return {
    boards: state.boards,
    settings: state.settings,
    presets: state.presets
  };
}

function cleanupIfIdle() {
  if (!state.settings.autoCleanupEnabled) return;
  const last = Date.parse(state.settings.lastAppAccessAt || "");
  if (!Number.isFinite(last)) return;
  const idleMs = Math.max(1, Number(state.settings.autoCleanupIdleHours || 24)) * 60 * 60 * 1000;
  if (Date.now() - last > idleMs && state.boards.length) {
    state.boards = [];
    broadcast("boards cleaned up", {});
  }
}

function touchAccess() {
  state.settings.lastAppAccessAt = new Date().toISOString();
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function listenWithFallback(targetServer, startPort) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryListen = () => {
      const nextPort = startPort + attempt;
      const onError = (error) => {
        targetServer.off("listening", onListening);
        if (error.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS) {
          attempt += 1;
          tryListen();
        } else {
          reject(error);
        }
      };
      const onListening = () => {
        targetServer.off("error", onError);
        resolve(nextPort);
      };
      targetServer.once("error", onError);
      targetServer.once("listening", onListening);
      targetServer.listen(nextPort, HOST);
    };

    tryListen();
  });
}
