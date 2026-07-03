// @ts-check

export const VIEWER_SETTINGS_KEY = "baseball-scoreboard.viewer";
export const DEFAULT_BOARD_WIDTH = 520;
export const BOARD_ASPECT_RATIO = 1200 / 560;
export const MIN_BOARD_SCALE = 25;
export const MAX_BOARD_SCALE = 300;

export function loadViewerSettings() {
  try {
    return normalizeViewerSettings(JSON.parse(localStorage.getItem(VIEWER_SETTINGS_KEY) || "{}"));
  } catch {
    return defaultViewerSettings();
  }
}

export function saveViewerSettings(settings) {
  const normalized = normalizeViewerSettings(settings);
  localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function defaultViewerSettings() {
  return {
    backgroundColor: "#ffffff",
    defaultScale: 100,
    boardPositions: {},
    boardScales: {},
    boardStackOrder: []
  };
}

export function normalizeViewerSettings(raw) {
  const legacyScale = numberOrDefault(raw?.scale, 100);
  const legacyWidth = numberOrDefault(raw?.boardWidth, DEFAULT_BOARD_WIDTH);
  const migratedScale = clampScale(Math.round((legacyScale * legacyWidth) / DEFAULT_BOARD_WIDTH));
  return {
    backgroundColor: String(raw?.backgroundColor || "#ffffff"),
    defaultScale: clampScale(numberOrDefault(raw?.defaultScale, migratedScale)),
    boardPositions: raw?.boardPositions && typeof raw.boardPositions === "object" ? raw.boardPositions : {},
    boardScales: raw?.boardScales && typeof raw.boardScales === "object" ? raw.boardScales : {},
    boardStackOrder: Array.isArray(raw?.boardStackOrder) ? raw.boardStackOrder.map(String) : []
  };
}

export function getBoardTransform(settings, boardId) {
  const position = settings.boardPositions?.[boardId] || {};
  return {
    x: numberOrDefault(position.x, 0),
    y: numberOrDefault(position.y, 0),
    scale: getBoardScale(settings, boardId)
  };
}

export function getBoardScale(settings, boardId) {
  return clampScale(numberOrDefault(settings.boardScales?.[boardId], settings.defaultScale));
}

export function defaultBoardTransform(settings) {
  return { x: 0, y: 0, scale: settings.defaultScale || 100 };
}

export function setBoardTransform(settings, boardId, next) {
  const current = getBoardTransform(settings, boardId);
  const transform = {
    x: Number.isFinite(next.x) ? next.x : current.x,
    y: Number.isFinite(next.y) ? next.y : current.y,
    scale: clampScale(Number.isFinite(next.scale) ? next.scale : current.scale)
  };
  return normalizeViewerSettings({
    ...settings,
    boardPositions: {
      ...(settings.boardPositions || {}),
      [boardId]: { x: transform.x, y: transform.y }
    },
    boardScales: {
      ...(settings.boardScales || {}),
      [boardId]: transform.scale
    },
    boardStackOrder: bumpBoardStackOrder(settings, boardId)
  });
}

export function resetBoardTransform(settings, boardId) {
  const positions = { ...(settings.boardPositions || {}) };
  const scales = { ...(settings.boardScales || {}) };
  delete positions[boardId];
  delete scales[boardId];
  return normalizeViewerSettings({
    ...settings,
    boardPositions: positions,
    boardScales: scales,
    boardStackOrder: bumpBoardStackOrder(settings, boardId)
  });
}

export function bumpBoardStackOrder(settings, boardId) {
  return [...(settings.boardStackOrder || []).filter((id) => id !== boardId), boardId];
}

export function getBoardZIndex(settings, boardId) {
  const index = (settings.boardStackOrder || []).indexOf(boardId);
  return index === -1 ? 1 : index + 2;
}

export function scaleToBoardSize(scale) {
  return Math.round((DEFAULT_BOARD_WIDTH * clampScale(scale)) / 100);
}

export function boardSizeToScale(size) {
  return (numberOrDefault(size, DEFAULT_BOARD_WIDTH) / DEFAULT_BOARD_WIDTH) * 100;
}

export function clampScale(scale) {
  return Math.max(MIN_BOARD_SCALE, Math.min(MAX_BOARD_SCALE, numberOrDefault(scale, 100)));
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
