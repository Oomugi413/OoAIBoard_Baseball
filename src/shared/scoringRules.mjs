export const SIDES = Object.freeze({
  AWAY: "away",
  HOME: "home"
});

export const HALF = Object.freeze({
  TOP: "top",
  BOTTOM: "bottom"
});

export const BASES = Object.freeze(["first", "second", "third"]);

export const DEFAULT_OVERLAY_SECONDS = 3;

export function createDefaultGameState() {
  return {
    inningNumber: 1,
    inningHalf: HALF.TOP,
    balls: 0,
    strikes: 0,
    outs: 0,
    runners: {
      first: false,
      second: false,
      third: false
    },
    score: {
      away: 0,
      home: 0
    },
    abs: {
      away: 2,
      home: 2
    },
    overlay: null
  };
}

export function createDefaultTeamSettings() {
  return {
    away: {
      side: SIDES.AWAY,
      name: "TeamA",
      abbreviation: "TeamA",
      logoPath: "",
      teamColor: "#ef1d2f",
      textColor: "#ffffff",
      abbreviationScale: 100,
      abbreviationWidth: 100,
      abbreviationCentered: false,
      linkedPresetId: null
    },
    home: {
      side: SIDES.HOME,
      name: "TeamB",
      abbreviation: "TeamB",
      logoPath: "",
      teamColor: "#4350d8",
      textColor: "#ffffff",
      abbreviationScale: 100,
      abbreviationWidth: 100,
      abbreviationCentered: false,
      linkedPresetId: null
    }
  };
}

export function createDefaultPlayerSettings() {
  return {
    matchupEnabled: true,
    away: createDefaultSidePlayers(SIDES.AWAY),
    home: createDefaultSidePlayers(SIDES.HOME),
    currentBattingOrderIndex: {
      away: 0,
      home: 0
    }
  };
}

function createDefaultSidePlayers(side) {
  const label = side === SIDES.AWAY ? "A" : "B";
  return {
    battingOrder: Array.from({ length: 9 }, (_, index) => ({
      battingOrderNumber: index + 1,
      playerName: `${label}.Batter${index + 1}`,
      isPinchHitter: false,
      homeRuns: 0,
      hits: 0,
      strikeoutsSwinging: 0,
      strikeoutsLooking: 0,
      outs: 0,
      others: 0
    })),
    pitchers: [
      {
        pitcherName: `${label}.Pitcher`,
        pitchCount: 0,
        strikeouts: 0,
        order: 1
      }
    ]
  };
}

export function createDefaultDisplayOptions() {
  return {
    showAbs: true,
    showMatchup: true
  };
}

export function createDefaultSettings() {
  return {
    autoCleanupEnabled: true,
    autoCleanupIdleHours: 24,
    lastAppAccessAt: new Date().toISOString(),
    overlayDisplaySeconds: DEFAULT_OVERLAY_SECONDS
  };
}

export function createBoard(id, name = "新しいスコアボード") {
  const now = new Date().toISOString();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    gameState: createDefaultGameState(),
    teamSettings: createDefaultTeamSettings(),
    playerSettings: createDefaultPlayerSettings(),
    displayOptions: createDefaultDisplayOptions(),
    undoHistory: [],
    redoHistory: []
  };
}

export function applyAction(board, action, settings = createDefaultSettings()) {
  const type = action?.type;
  const payload = action?.payload || {};

  switch (type) {
    case "pitch:ball":
      return withHistory(board, (draft) => {
        draft.gameState.balls = clamp(draft.gameState.balls + 1, 0, 4);
        incrementPitchCount(draft);
      });

    case "pitch:strike":
      return withHistory(board, (draft) => {
        draft.gameState.strikes = clamp(draft.gameState.strikes + 1, 0, 3);
        incrementPitchCount(draft);
      });

    case "pitch:foul":
      return withHistory(board, (draft) => {
        draft.gameState.strikes = clamp(draft.gameState.strikes + (draft.gameState.strikes < 2 ? 1 : 0), 0, 3);
        incrementPitchCount(draft);
      });

    case "count:balls":
      return withHistory(board, (draft) => {
        draft.gameState.balls = clamp(draft.gameState.balls + numberOrZero(payload.delta), 0, 4);
      });

    case "count:strikes":
      return withHistory(board, (draft) => {
        draft.gameState.strikes = clamp(draft.gameState.strikes + numberOrZero(payload.delta), 0, 3);
      });

    case "count:reset":
      return withHistory(board, (draft) => {
        draft.gameState.balls = 0;
        draft.gameState.strikes = 0;
      });

    case "plate:result":
      return withHistory(board, (draft) => {
        applyPlateAppearance(draft, payload.result, settings);
      });

    case "outs:adjust":
      return withHistory(board, (draft) => {
        draft.gameState.outs = clamp(draft.gameState.outs + numberOrZero(payload.delta), 0, 3);
      });

    case "outs:runningOut":
      return withHistory(board, (draft) => {
        draft.gameState.outs = clamp(draft.gameState.outs + 1, 0, 3);
      });

    case "outs:caughtStealing":
      return withHistory(board, (draft) => {
        draft.gameState.outs = clamp(draft.gameState.outs + 1, 0, 3);
        draft.gameState.keepCurrentBatterOnNextInning = true;
      });

    case "inning:change":
      if (board.gameState.outs !== 3) {
        return { board, changed: false, error: "チェンジはアウト3のときのみ使用できます。" };
      }
      return withHistory(board, (draft) => {
        if (draft.gameState.inningHalf === HALF.TOP) {
          draft.gameState.inningHalf = HALF.BOTTOM;
        } else {
          draft.gameState.inningHalf = HALF.TOP;
          draft.gameState.inningNumber += 1;
        }
        draft.gameState.balls = 0;
        draft.gameState.strikes = 0;
        draft.gameState.outs = 0;
        clearRunners(draft.gameState);
        draft.gameState.keepCurrentBatterOnNextInning = false;
      });

    case "runner:toggle":
      return withHistory(board, (draft) => {
        const base = BASES.includes(payload.base) ? payload.base : null;
        if (base) draft.gameState.runners[base] = !draft.gameState.runners[base];
      });

    case "score:adjust":
      return withHistory(board, (draft) => {
        const side = normalizeSide(payload.side);
        if (!side) return;
        draft.gameState.score[side] = Math.max(0, draft.gameState.score[side] + numberOrZero(payload.delta));
      });

    case "abs:adjust":
      return withHistory(board, (draft) => {
        const side = normalizeSide(payload.side);
        if (!side) return;
        draft.gameState.abs[side] = Math.max(0, draft.gameState.abs[side] + numberOrZero(payload.delta));
      });

    case "history:undo":
      return undo(board);

    case "history:redo":
      return redo(board);

    case "game:reset":
      return resetGame(board);

    case "board:rename":
      return {
        board: {
          ...board,
          name: String(payload.name || "").trim() || board.name,
          updatedAt: new Date().toISOString()
        },
        changed: true
      };

    case "board:patchConfig":
      return patchBoardConfig(board, payload);

    case "team:update":
      return updateTeam(board, payload);

    case "display:update":
      return updateDisplayOptions(board, payload);

    case "players:update":
      return updatePlayers(board, payload);

    case "players:patch":
      return patchPlayers(board, payload);

    default:
      return { board, changed: false, error: `未対応の操作です: ${type}` };
  }
}

function withHistory(board, mutator) {
  const draft = structuredCloneCompat(board);
  const snapshot = snapshotBoard(board);
  mutator(draft);
  draft.undoHistory = [...(board.undoHistory || []), snapshot].slice(-100);
  draft.redoHistory = [];
  draft.updatedAt = new Date().toISOString();
  return { board: draft, changed: true };
}

function undo(board) {
  const undoHistory = board.undoHistory || [];
  if (!undoHistory.length) return { board, changed: false };
  const previous = undoHistory[undoHistory.length - 1];
  const next = structuredCloneCompat(board);
  next.gameState = previous.gameState;
  next.playerSettings = previous.playerSettings;
  next.displayOptions = previous.displayOptions;
  next.undoHistory = undoHistory.slice(0, -1);
  next.redoHistory = [...(board.redoHistory || []), snapshotBoard(board)].slice(-100);
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function redo(board) {
  const redoHistory = board.redoHistory || [];
  if (!redoHistory.length) return { board, changed: false };
  const nextSnapshot = redoHistory[redoHistory.length - 1];
  const next = structuredCloneCompat(board);
  next.gameState = nextSnapshot.gameState;
  next.playerSettings = nextSnapshot.playerSettings;
  next.displayOptions = nextSnapshot.displayOptions;
  next.redoHistory = redoHistory.slice(0, -1);
  next.undoHistory = [...(board.undoHistory || []), snapshotBoard(board)].slice(-100);
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function resetGame(board) {
  const next = structuredCloneCompat(board);
  next.gameState = createDefaultGameState();
  next.playerSettings = resetPlayerGameValues(next.playerSettings);
  next.undoHistory = [];
  next.redoHistory = [];
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function snapshotBoard(board) {
  return structuredCloneCompat({
    gameState: board.gameState,
    playerSettings: board.playerSettings,
    displayOptions: board.displayOptions
  });
}

function resetPlayerGameValues(playerSettings) {
  const next = structuredCloneCompat(playerSettings || createDefaultPlayerSettings());
  next.currentBattingOrderIndex = { away: 0, home: 0 };
  for (const side of [SIDES.AWAY, SIDES.HOME]) {
    const sideSettings = next[side];
    if (!sideSettings) continue;
    sideSettings.battingOrder = (sideSettings.battingOrder || []).map((player, index) => ({
      ...player,
      battingOrderNumber: Number(player?.battingOrderNumber) || index + 1,
      homeRuns: 0,
      hits: 0,
      strikeoutsSwinging: 0,
      strikeoutsLooking: 0,
      outs: 0,
      others: 0
    }));
    sideSettings.pitchers = (sideSettings.pitchers || []).map((pitcher, index) => ({
      ...pitcher,
      pitchCount: 0,
      strikeouts: 0,
      order: Number.isFinite(Number(pitcher?.order)) ? Number(pitcher.order) : index + 1
    }));
  }
  return next;
}

function applyPlateAppearance(board, result, settings) {
  const normalized = String(result || "");
  incrementPitchCount(board);

  switch (normalized) {
    case "homeRun": {
      const runs = countRunners(board.gameState) + 1;
      const attackingSide = getAttackingSide(board.gameState);
      board.gameState.score[attackingSide] += runs;
      clearRunners(board.gameState);
      addBatterStat(board, "homeRuns");
      board.gameState.overlay = createOverlay("HOME RUN", settings);
      break;
    }
    case "hit":
      addBatterStat(board, "hits");
      break;
    case "walk":
      advanceForcedRunners(board);
      addBatterStat(board, "others");
      break;
    case "hitByPitch":
      advanceForcedRunners(board);
      addBatterStat(board, "others");
      break;
    case "out":
      addBatterStat(board, "outs");
      break;
    case "strikeoutSwinging":
      addBatterStat(board, "strikeoutsSwinging");
      addPitcherStat(board, "strikeouts");
      board.gameState.overlay = createOverlay("K", settings, false, "strikeout");
      break;
    case "strikeoutLooking":
      addBatterStat(board, "strikeoutsLooking");
      addPitcherStat(board, "strikeouts");
      board.gameState.overlay = createOverlay("K", settings, true, "strikeout");
      break;
    case "other":
      addBatterStat(board, "others");
      break;
    default:
      break;
  }

  board.gameState.balls = 0;
  board.gameState.strikes = 0;
  advanceBatter(board);
}

function incrementPitchCount(board) {
  if (!board.displayOptions?.showMatchup && !board.playerSettings?.matchupEnabled) return;
  const defendingSide = getDefendingSide(board.gameState);
  const pitchers = board.playerSettings?.[defendingSide]?.pitchers || [];
  if (!pitchers.length) return;
  pitchers[pitchers.length - 1].pitchCount += 1;
}

function addBatterStat(board, statName) {
  const batter = getCurrentBatter(board);
  if (!batter || typeof batter[statName] !== "number") return;
  batter[statName] += 1;
}

function addPitcherStat(board, statName) {
  const pitcher = getCurrentPitcher(board);
  if (!pitcher) return;
  // 既存データ（このフィールド追加前に保存されたピッチャー記録）にも対応できるよう、
  // 数値でない場合は0として扱ってから加算する。
  const current = typeof pitcher[statName] === "number" ? pitcher[statName] : 0;
  pitcher[statName] = current + 1;
}

function advanceBatter(board) {
  const side = getAttackingSide(board.gameState);
  const current = board.playerSettings.currentBattingOrderIndex?.[side] || 0;
  board.playerSettings.currentBattingOrderIndex[side] = (current + 1) % 9;
}

export function getCurrentBatter(board) {
  const side = getAttackingSide(board.gameState);
  const index = board.playerSettings?.currentBattingOrderIndex?.[side] || 0;
  return board.playerSettings?.[side]?.battingOrder?.[index] || null;
}

export function getCurrentPitcher(board) {
  const side = getDefendingSide(board.gameState);
  const pitchers = board.playerSettings?.[side]?.pitchers || [];
  return pitchers[pitchers.length - 1] || null;
}

export function getAttackingSide(gameState) {
  return gameState.inningHalf === HALF.TOP ? SIDES.AWAY : SIDES.HOME;
}

export function getDefendingSide(gameState) {
  return gameState.inningHalf === HALF.TOP ? SIDES.HOME : SIDES.AWAY;
}

export function calculateBatterLine(batter) {
  if (!batter) return "0-0";
  const hits = (batter.homeRuns || 0) + (batter.hits || 0);
  const atBats =
    (batter.homeRuns || 0) +
    (batter.hits || 0) +
    (batter.strikeoutsSwinging || 0) +
    (batter.strikeoutsLooking || 0) +
    (batter.outs || 0);
  return `${hits}-${atBats}`;
}

function createOverlay(message, settings, reverse = false, kind = "default") {
  const seconds = kind === "strikeout"
    ? DEFAULT_OVERLAY_SECONDS
    : Number(settings?.overlayDisplaySeconds || DEFAULT_OVERLAY_SECONDS);
  return {
    message,
    reverse,
    kind,
    expiresAt: Date.now() + seconds * 1000
  };
}

function countRunners(gameState) {
  return BASES.reduce((count, base) => count + (gameState.runners[base] ? 1 : 0), 0);
}

function clearRunners(gameState) {
  for (const base of BASES) {
    gameState.runners[base] = false;
  }
}

function advanceForcedRunners(board) {
  const runners = board.gameState.runners;
  const attackingSide = getAttackingSide(board.gameState);
  if (runners.first && runners.second && runners.third) {
    board.gameState.score[attackingSide] += 1;
  }
  if (runners.first && runners.second) {
    runners.third = true;
  }
  if (runners.first) {
    runners.second = true;
  }
  runners.first = true;
}

function updateTeam(board, payload) {
  const side = normalizeSide(payload.side);
  if (!side) return { board, changed: false, error: "チーム側が不正です。" };
  const next = structuredCloneCompat(board);
  next.teamSettings[side] = {
    ...next.teamSettings[side],
    ...payload.values,
    side
  };
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function patchBoardConfig(board, payload) {
  const next = structuredCloneCompat(board);
  next.teamSettings = next.teamSettings || createDefaultTeamSettings();
  next.displayOptions = next.displayOptions || createDefaultDisplayOptions();
  next.playerSettings = next.playerSettings || createDefaultPlayerSettings();
  let changed = false;

  if (Object.hasOwn(payload, "name")) {
    const name = String(payload.name || "").trim() || next.name;
    if (name !== next.name) {
      next.name = name;
      changed = true;
    }
  }

  const teams = payload.teams && typeof payload.teams === "object" ? payload.teams : {};
  const defaultTeamSettings = createDefaultTeamSettings();
  for (const side of [SIDES.AWAY, SIDES.HOME]) {
    const values = teams[side] && typeof teams[side] === "object" ? teams[side] : null;
    if (!values) continue;
    next.teamSettings[side] = next.teamSettings[side] || defaultTeamSettings[side];
    const current = next.teamSettings[side];
    applyTeamPatch(current, values, "name", (value) => String(value || ""));
    applyTeamPatch(current, values, "abbreviation", (value) => String(value || ""));
    applyTeamPatch(current, values, "logoPath", (value) => String(value || ""));
    applyTeamPatch(current, values, "teamColor", (value) => String(value || "#1f5fbf"));
    applyTeamPatch(current, values, "textColor", (value) => String(value || "#ffffff"));
    applyTeamPatch(current, values, "linkedPresetId", (value) => value ? String(value) : null);
    applyTeamPatch(current, values, "abbreviationScale", (value) => clamp(Number(value) || 100, 60, 180));
    applyTeamPatch(current, values, "abbreviationWidth", (value) => clamp(Number(value) || 100, 30, 120));
    applyTeamPatch(current, values, "abbreviationCentered", (value) => Boolean(value));
  }

  const displayOptions = payload.displayOptions && typeof payload.displayOptions === "object"
    ? payload.displayOptions
    : {};
  if (Object.hasOwn(displayOptions, "showAbs")) {
    const showAbs = Boolean(displayOptions.showAbs);
    if (next.displayOptions.showAbs !== showAbs) {
      next.displayOptions.showAbs = showAbs;
      changed = true;
    }
  }
  if (Object.hasOwn(displayOptions, "showMatchup")) {
    const showMatchup = Boolean(displayOptions.showMatchup);
    if (next.displayOptions.showMatchup !== showMatchup) {
      next.displayOptions.showMatchup = showMatchup;
      changed = true;
    }
    if (next.playerSettings.matchupEnabled !== showMatchup) {
      next.playerSettings.matchupEnabled = showMatchup;
      changed = true;
    }
  }

  if (!changed) return { board, changed: false };
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };

  function applyTeamPatch(current, values, field, normalize) {
    if (!Object.hasOwn(values, field)) return;
    const value = normalize(values[field]);
    if (current[field] === value) return;
    current[field] = value;
    changed = true;
  }
}

function updateDisplayOptions(board, payload) {
  const next = structuredCloneCompat(board);
  next.displayOptions = {
    ...next.displayOptions,
    ...payload
  };
  next.playerSettings.matchupEnabled = Boolean(next.displayOptions.showMatchup);
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function updatePlayers(board, payload) {
  const next = structuredCloneCompat(board);
  next.playerSettings = {
    ...next.playerSettings,
    ...payload
  };
  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function patchPlayers(board, payload) {
  const next = structuredCloneCompat(board);
  const playerSettings = next.playerSettings || createDefaultPlayerSettings();
  next.playerSettings = playerSettings;

  for (const side of [SIDES.AWAY, SIDES.HOME]) {
    const sideSettings = playerSettings[side] || createDefaultSidePlayers(side);
    playerSettings[side] = sideSettings;

    const batterUpdates = payload?.battingOrderUpdates?.[side] || {};
    for (const [rawIndex, values] of Object.entries(batterUpdates)) {
      const index = Number(rawIndex);
      const batter = sideSettings.battingOrder?.[index];
      if (!batter) continue;
      if (Object.hasOwn(values, "playerName")) {
        const playerName = String(values.playerName || "");
        if (batter.playerName !== playerName) resetBatterStats(batter);
        batter.playerName = playerName;
      }
      if (Object.hasOwn(values, "isPinchHitter")) batter.isPinchHitter = Boolean(values.isPinchHitter);
    }

    const pitcherUpdates = payload?.pitcherUpdates?.[side] || {};
    for (const [rawIndex, values] of Object.entries(pitcherUpdates)) {
      const index = Number(rawIndex);
      const pitcher = sideSettings.pitchers?.[index];
      if (!pitcher) continue;
      if (Object.hasOwn(values, "pitcherName")) pitcher.pitcherName = String(values.pitcherName || "");
      if (Object.hasOwn(values, "pitchCount")) pitcher.pitchCount = Math.max(0, Number(values.pitchCount || 0));
      if (Object.hasOwn(values, "strikeouts")) pitcher.strikeouts = Math.max(0, Number(values.strikeouts || 0));
    }

    const addedPitchers = Array.isArray(payload?.addedPitchers?.[side]) ? payload.addedPitchers[side] : [];
    for (const added of addedPitchers) {
      const order = (sideSettings.pitchers || []).length + 1;
      sideSettings.pitchers = [
        ...(sideSettings.pitchers || []),
        {
          pitcherName: String(added?.pitcherName || `${side === SIDES.AWAY ? "A" : "B"}.Pitcher${order}`),
          pitchCount: Math.max(0, Number(added?.pitchCount || 0)),
          strikeouts: Math.max(0, Number(added?.strikeouts || 0)),
          order
        }
      ];
    }
  }

  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function resetBatterStats(batter) {
  batter.homeRuns = 0;
  batter.hits = 0;
  batter.strikeoutsSwinging = 0;
  batter.strikeoutsLooking = 0;
  batter.outs = 0;
  batter.others = 0;
}

function normalizeSide(side) {
  if (side === SIDES.AWAY || side === SIDES.HOME) return side;
  return null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function structuredCloneCompat(value) {
  return JSON.parse(JSON.stringify(value));
}
