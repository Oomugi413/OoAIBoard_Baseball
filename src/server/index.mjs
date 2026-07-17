import http from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAction,
  createBoard,
  createDefaultSettings,
  normalizeBoardData
} from "../shared/scoringRules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const distDir = path.join(rootDir, "dist");
const storageDir = process.env.BASEBALL_STORAGE_DIR
  ? path.resolve(process.env.BASEBALL_STORAGE_DIR)
  : path.join(rootDir, "storage", "data");
const uploadRootDir = path.join(rootDir, "storage", "uploads");
const teamLogoDir = path.join(uploadRootDir, "team-logos");
const dataFile = path.join(storageDir, "app.json");
const DEFAULT_PORT = Number(process.env.PORT || 52582);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_PORT_ATTEMPTS = 20;
const MAX_LOGO_UPLOAD_BYTES = 750 * 1024;
let saveQueue = Promise.resolve();
let saveSequence = 0;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const sseClients = new Set();
let state = await loadState();
const migratedBoardData = state.boards.reduce(
  (changed, board) => normalizeBoardData(board) || changed,
  false
);
await cleanupExpiredBoards();
if (migratedBoardData) await saveState();

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    if (res.headersSent) return;
    if (error?.statusCode) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }
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
    await cleanupExpiredBoards();
    await handleApi(req, res, url);
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

  if (req.method === "POST" && url.pathname === "/api/uploads/team-logo") {
    const body = await readJsonBody(req);
    const result = await saveTeamLogoUpload(body.dataUrl);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }
    sendJson(res, 201, { logoPath: result.logoPath });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/uploads/unused-team-logos") {
    const result = await deleteUnusedTeamLogos();
    sendJson(res, 200, result);
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
    delete state.settings.lastAppAccessAt;
    await saveState();
    broadcast("settings changed", { settings: state.settings });
    sendJson(res, 200, state.settings);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/presets") {
    sendJson(res, 200, state.presets);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presets") {
    const body = await readJsonBody(req);
    const preset = createTeamPreset(body);
    state.presets.push(preset);
    await saveState();
    broadcast("preset changed", { preset });
    sendJson(res, 201, preset);
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/presets/order") {
    const body = await readJsonBody(req);
    const result = reorderTeamPresets(body.presetIds);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }
    await saveState();
    broadcast("preset order changed", { presets: state.presets });
    sendJson(res, 200, state.presets);
    return;
  }

  const presetMatch = url.pathname.match(/^\/api\/presets\/([^/]+)$/);
  if (presetMatch) {
    const presetId = decodeURIComponent(presetMatch[1]);
    const presetIndex = state.presets.findIndex((preset) => preset.id === presetId);
    if (presetIndex === -1) {
      sendJson(res, 404, { error: "チームプリセットが見つかりません。" });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJsonBody(req);
      state.presets[presetIndex] = updateTeamPreset(state.presets[presetIndex], body);
      await saveState();
      broadcast("preset changed", { preset: state.presets[presetIndex] });
      sendJson(res, 200, state.presets[presetIndex]);
      return;
    }

    if (req.method === "DELETE") {
      const [deleted] = state.presets.splice(presetIndex, 1);
      const boardIds = [];
      for (const board of state.boards) {
        let unlinked = false;
        for (const side of ["away", "home"]) {
          if (board.teamSettings?.[side]?.linkedPresetId !== deleted.id) continue;
          board.teamSettings[side].linkedPresetId = null;
          unlinked = true;
        }
        if (unlinked) boardIds.push(board.id);
      }
      await saveState();
      broadcast("preset deleted", { presetId: deleted.id, boardIds });
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/boards") {
    sendJson(res, 200, state.boards.map(publicBoard));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/boards") {
    const body = await readJsonBody(req);
    const board = createBoard(randomUUID(), body.name || `Scoreboard ${state.boards.length + 1}`);
    state.boards.push(board);
    await saveState();
    broadcast("board created", { board: publicBoard(board) });
    sendJson(res, 201, publicBoard(board));
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
      await saveState();
      sendJson(res, 200, publicBoard(state.boards[boardIndex]));
      return;
    }

    if (req.method === "POST" && boardMatch[2] === "action") {
      const body = await readJsonBody(req);
      const result = applyAction(state.boards[boardIndex], body, state.settings);
      if (result.error) {
        sendJson(res, 400, { error: result.error, board: publicBoard(result.board) });
        return;
      }
      state.boards[boardIndex] = result.board;
      state.boards[boardIndex].lastAccessedAt = new Date().toISOString();
      await saveState();
      if (result.changed) {
        broadcast("board state changed", { board: publicBoard(state.boards[boardIndex]) });
      }
      sendJson(res, 200, publicBoard(state.boards[boardIndex]));
      return;
    }

    if (req.method === "DELETE" && !boardMatch[2]) {
      const [deleted] = state.boards.splice(boardIndex, 1);
      await saveState();
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
  if (pathname.startsWith("/uploads/")) {
    const relativeUploadPath = pathname.slice("/uploads/".length);
    const uploadCandidate = path.normalize(path.join(uploadRootDir, relativeUploadPath));
    if (!isPathInsideDirectory(uploadCandidate, uploadRootDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    await serveFile(req, res, uploadCandidate);
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const candidate = path.normalize(path.join(distDir, pathname));
  if (!isPathInsideDirectory(candidate, distDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  if (pathname === "/index.html") {
    try {
      await stat(candidate);
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ビルドファイルが見つかりません。`npm start` を実行すると、ビルドしてから起動します。");
      return;
    }
  }

  await serveFile(req, res, candidate);
}

async function serveFile(req, res, candidate) {
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

async function saveTeamLogoUpload(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/png|image\/jpeg);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return { error: "PNGまたはJPEG画像を選択してください。" };

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return { error: "画像データが空です。" };
  if (buffer.length > MAX_LOGO_UPLOAD_BYTES) return { error: "画像データが大きすぎます。" };
  if (mimeType === "image/png" && !isPng(buffer)) return { error: "PNG画像として読み込めません。" };
  if (mimeType === "image/jpeg" && !isJpeg(buffer)) return { error: "JPEG画像として読み込めません。" };

  await mkdir(teamLogoDir, { recursive: true });
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  await writeFile(path.join(teamLogoDir, fileName), buffer);
  return { logoPath: `/uploads/team-logos/${fileName}` };
}

function isPng(buffer) {
  return buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
}

function isJpeg(buffer) {
  return buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9;
}

function handleSse(req, res) {
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
    const settings = {
      ...createDefaultSettings(),
      ...(parsed.settings || {})
    };
    delete settings.lastAppAccessAt;
    return {
      boards: Array.isArray(parsed.boards) ? parsed.boards : [],
      settings,
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

function saveState() {
  // Capture now and write snapshots in request order so an older rename cannot win a race.
  const serialized = JSON.stringify(state, null, 2);
  const sequence = ++saveSequence;
  const operation = saveQueue.then(async () => {
    await mkdir(storageDir, { recursive: true });
    const temporaryFile = path.join(storageDir, `app.${process.pid}.${sequence}.tmp`);
    await writeFile(temporaryFile, serialized, "utf8");
    await rename(temporaryFile, dataFile);
  });
  saveQueue = operation.catch(() => {});
  return operation;
}

function publicState() {
  return {
    boards: state.boards.map(publicBoard),
    settings: state.settings,
    presets: state.presets
  };
}

function publicBoard(board) {
  const { undoHistory: _undoHistory, redoHistory: _redoHistory, ...visibleBoard } = board;
  return visibleBoard;
}

async function deleteUnusedTeamLogos() {
  await mkdir(teamLogoDir, { recursive: true });
  const usedLogoPaths = collectUsedTeamLogoPaths();
  const entries = await readdir(teamLogoDir, { withFileTypes: true });
  const deletedLogoPaths = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const logoPath = `/uploads/team-logos/${entry.name}`;
    if (usedLogoPaths.has(logoPath)) continue;

    const targetPath = path.resolve(teamLogoDir, entry.name);
    if (!isPathInsideDirectory(targetPath, teamLogoDir)) continue;

    await unlink(targetPath);
    deletedLogoPaths.push(logoPath);
  }

  return {
    deletedCount: deletedLogoPaths.length,
    deletedLogoPaths
  };
}

function collectUsedTeamLogoPaths() {
  const used = new Set();
  for (const board of state.boards || []) {
    for (const side of ["away", "home"]) {
      addLocalTeamLogoPath(used, board.teamSettings?.[side]?.logoPath);
    }
  }
  for (const preset of state.presets || []) {
    addLocalTeamLogoPath(used, preset.logoPath);
  }
  return used;
}

function addLocalTeamLogoPath(target, logoPath) {
  const value = String(logoPath || "");
  if (value.startsWith("/uploads/team-logos/")) target.add(value);
}

function isPathInsideDirectory(targetPath, parentDir) {
  const relative = path.relative(parentDir, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function createTeamPreset(values = {}) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    ...normalizeTeamPreset(values),
    createdAt: now,
    updatedAt: now
  };
}

function updateTeamPreset(current, values = {}) {
  return {
    ...current,
    ...normalizeTeamPreset(values),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  };
}

function reorderTeamPresets(presetIds) {
  if (!Array.isArray(presetIds)) return { error: "プリセット順が不正です。" };
  const currentById = new Map(state.presets.map((preset) => [preset.id, preset]));
  const seen = new Set();
  const ordered = [];

  for (const rawId of presetIds) {
    const id = String(rawId);
    const preset = currentById.get(id);
    if (!preset || seen.has(id)) continue;
    seen.add(id);
    ordered.push(preset);
  }

  for (const preset of state.presets) {
    if (!seen.has(preset.id)) ordered.push(preset);
  }

  state.presets = ordered;
  return { presets: state.presets };
}

function normalizeTeamPreset(values = {}) {
  const teamName = String(values.name || values.teamName || "").trim() || "Team";
  const abbreviation = String(values.abbreviation || teamName).trim() || teamName;
  return {
    presetName: String(values.presetName || values.name || "Team Preset").trim() || "Team Preset",
    name: teamName,
    abbreviation,
    logoPath: String(values.logoPath || "").trim(),
    teamColor: String(values.teamColor || "#1f5fbf").trim(),
    textColor: String(values.textColor || "#ffffff").trim(),
    abbreviationWidth: clampNumber(values.abbreviationWidth, 30, 120, 100)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

async function cleanupExpiredBoards() {
  if (!state.settings.autoCleanupEnabled) return;
  const idleMs = Math.max(1, Number(state.settings.autoCleanupIdleHours || 24)) * 60 * 60 * 1000;
  const cutoff = Date.now() - idleMs;
  const removed = state.boards.filter((board) => {
    const lastAccessedAt = Date.parse(board.lastAccessedAt || board.updatedAt || board.createdAt || "");
    return Number.isFinite(lastAccessedAt) && lastAccessedAt < cutoff;
  });
  if (!removed.length) return;

  const boardIds = removed.map((board) => board.id);
  const removedIds = new Set(boardIds);
  state.boards = state.boards.filter((board) => !removedIds.has(board.id));
  await saveState();
  broadcast("boards cleaned up", { boardIds });
}

const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      const error = new Error("リクエストの内容が大きすぎます。");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
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
