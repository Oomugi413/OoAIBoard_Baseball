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
export const HALF_INNING_TRANSITION_SECONDS = 10;

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
    overlay: null,
    // 打席結果ボタンによるカウントリセットだけを検知するための単調カウンタ。
    // クライアント側はこの値の変化を「瞬時にカウントを0-0へ戻す」トリガーとして使う
    // （カウントRS・スコアリセットによるリセットとは区別する）。
    plateAppearanceSeq: 0,
    // 攻守交代の中間表示（"Mid 1st"/"End 2nd"など）。チェンジ操作のたびに新しく設定する一時的な状態。
    halfInningTransition: null,
    // 試合終了操作で設定する永続的な状態。スコアリセットまたは「戻る」で解除するまで保持する。
    finalResult: null
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
        pitcherId: createPitcherId(),
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
        const finishedInningNumber = draft.gameState.inningNumber;
        let label;
        if (draft.gameState.inningHalf === HALF.TOP) {
          draft.gameState.inningHalf = HALF.BOTTOM;
          label = `Mid ${ordinal(finishedInningNumber)}`;
        } else {
          draft.gameState.inningHalf = HALF.TOP;
          draft.gameState.inningNumber += 1;
          label = `End ${ordinal(finishedInningNumber)}`;
        }
        draft.gameState.balls = 0;
        draft.gameState.strikes = 0;
        draft.gameState.outs = 0;
        clearRunners(draft.gameState);
        draft.gameState.keepCurrentBatterOnNextInning = false;
        draft.gameState.halfInningTransition = {
          label,
          expiresAt: Date.now() + HALF_INNING_TRANSITION_SECONDS * 1000
        };
      });

    case "game:finish":
      return withHistory(board, (draft) => {
        const { away, home } = draft.gameState.score;
        // 得点の多いほうを勝者とする。同点の場合はどちらの帯も配色を変えない（winner: null）。
        const winner = away === home ? null : away > home ? SIDES.AWAY : SIDES.HOME;
        draft.gameState.finalResult = { winner };
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
  const previousSeq = board.gameState?.plateAppearanceSeq || 0;
  next.gameState = { ...createDefaultGameState(), plateAppearanceSeq: previousSeq };
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
      board.gameState.overlay = createOverlay("HOME RUN", settings, {
        kind: "homeRun",
        batterName: getCurrentBatter(board)?.playerName || ""
      });
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
      board.gameState.overlay = createOverlay("K", settings, {
        kind: "strikeout",
        batterName: getCurrentBatter(board)?.playerName || "",
        pitcherStrikeouts: getCurrentPitcher(board)?.strikeouts || 0
      });
      break;
    case "strikeoutLooking":
      addBatterStat(board, "strikeoutsLooking");
      addPitcherStat(board, "strikeouts");
      board.gameState.overlay = createOverlay("K", settings, {
        kind: "strikeout",
        reverse: true,
        batterName: getCurrentBatter(board)?.playerName || "",
        pitcherStrikeouts: getCurrentPitcher(board)?.strikeouts || 0
      });
      break;
    case "other":
      addBatterStat(board, "others");
      break;
    default:
      break;
  }

  board.gameState.balls = 0;
  board.gameState.strikes = 0;
  board.gameState.plateAppearanceSeq = (board.gameState.plateAppearanceSeq || 0) + 1;
  advanceBatter(board);
}

function incrementPitchCount(board) {
  if (!board.displayOptions?.showMatchup) return;
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

/**
 * 攻守交代の中間表示（表示中のみ）または試合終了状態のとき、対戦選手表示欄・
 * イニング表示欄を折りたたむべきかどうかを返す。ScoreboardView（クライアント表示用）
 * とViewer Page（アスペクト比計算用）の両方から参照する共通ロジック。
 */
export function isBoardCollapsed(gameState) {
  const transition = gameState?.halfInningTransition;
  const activeTransition = transition && transition.expiresAt > Date.now();
  return Boolean(activeTransition) || Boolean(gameState?.finalResult);
}

export function calculateBatterLine(batter) {
  const { hits, atBats } = calculateBatterStats(batter);
  return `${hits}-${atBats}`;
}

export function calculateBatterStats(batter) {
  if (!batter) return { hits: 0, atBats: 0 };
  const hits = (batter.homeRuns || 0) + (batter.hits || 0);
  const atBats =
    (batter.homeRuns || 0) +
    (batter.hits || 0) +
    (batter.strikeoutsSwinging || 0) +
    (batter.strikeoutsLooking || 0) +
    (batter.outs || 0);
  return { hits, atBats };
}

export function formatMatchupSummary(board) {
  const gameState = board.gameState;
  const away = board.teamSettings.away;
  const home = board.teamSettings.home;
  const inningHalf = gameState.inningHalf === HALF.TOP ? "表" : "裏";
  return `${away.abbreviation || away.name} ${gameState.score.away}-${gameState.score.home} ${home.abbreviation || home.name} ${gameState.inningNumber}回${inningHalf}`;
}

/**
 * 保存済みの旧データへピッチャーIDを補い、廃止済みの重複状態を除去する。
 * 現在値に加えて、undo/redoで復元され得る選手設定も正規化する。
 */
export function normalizeBoardData(board) {
  let changed = normalizePlayerSettings(board?.playerSettings);
  for (const historyName of ["undoHistory", "redoHistory"]) {
    for (const snapshot of board?.[historyName] || []) {
      changed = normalizePlayerSettings(snapshot?.playerSettings) || changed;
    }
  }
  return changed;
}

function createOverlay(message, settings, options = {}) {
  const { reverse = false, kind = "homeRun", batterName = "", pitcherStrikeouts = 0 } = options;
  const seconds = kind === "strikeout"
    ? DEFAULT_OVERLAY_SECONDS
    : Number(settings?.overlayDisplaySeconds || DEFAULT_OVERLAY_SECONDS);
  return {
    message,
    reverse,
    kind,
    batterName,
    pitcherStrikeouts,
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

function patchPlayers(board, payload) {
  const next = structuredCloneCompat(board);
  const playerSettings = next.playerSettings || createDefaultPlayerSettings();
  next.playerSettings = playerSettings;

  for (const side of [SIDES.AWAY, SIDES.HOME]) {
    const sideSettings = playerSettings[side] || createDefaultSidePlayers(side);
    playerSettings[side] = sideSettings;
    normalizePitcherList(sideSettings, side);

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
      applyPitcherValues(pitcher, values);
    }

    const pitcherUpdatesById = payload?.pitcherUpdatesById?.[side] || {};
    for (const [pitcherId, values] of Object.entries(pitcherUpdatesById)) {
      const pitcher = sideSettings.pitchers.find((item) => item.pitcherId === pitcherId);
      if (pitcher) applyPitcherValues(pitcher, values);
    }

    const removedPitcherIds = new Set(
      Array.isArray(payload?.removedPitcherIds?.[side])
        ? payload.removedPitcherIds[side].map(String)
        : []
    );
    if (removedPitcherIds.size > 0) {
      const beforeRemoval = sideSettings.pitchers;
      const remaining = beforeRemoval.filter((pitcher) => !removedPitcherIds.has(pitcher.pitcherId));
      sideSettings.pitchers = remaining.length ? remaining : beforeRemoval.slice(0, 1);
    }

    const addedPitchers = Array.isArray(payload?.addedPitchers?.[side]) ? payload.addedPitchers[side] : [];
    for (const added of addedPitchers) {
      const pitcherId = String(added?.pitcherId || "").trim() || createPitcherId();
      if (sideSettings.pitchers.some((pitcher) => pitcher.pitcherId === pitcherId)) continue;
      const order = (sideSettings.pitchers || []).length + 1;
      sideSettings.pitchers = [
        ...(sideSettings.pitchers || []),
        {
          pitcherId,
          pitcherName: String(added?.pitcherName || `${side === SIDES.AWAY ? "A" : "B"}.Pitcher${order}`),
          pitchCount: Math.max(0, Number(added?.pitchCount || 0)),
          strikeouts: Math.max(0, Number(added?.strikeouts || 0)),
          order
        }
      ];
    }

    // 末尾から指定件数だけ削除する。1人目（先頭）は常に残す。
    const removedCount = Math.max(0, Number(payload?.removedPitchers?.[side] || 0));
    if (removedCount > 0) {
      const keepLength = Math.max(1, (sideSettings.pitchers || []).length - removedCount);
      sideSettings.pitchers = (sideSettings.pitchers || []).slice(0, keepLength);
    }
    sideSettings.pitchers.forEach((pitcher, index) => {
      pitcher.order = index + 1;
    });
  }

  next.updatedAt = new Date().toISOString();
  return { board: next, changed: true };
}

function applyPitcherValues(pitcher, values) {
  if (Object.hasOwn(values, "pitcherName")) pitcher.pitcherName = String(values.pitcherName || "");
  if (Object.hasOwn(values, "pitchCount")) pitcher.pitchCount = Math.max(0, Number(values.pitchCount || 0));
  if (Object.hasOwn(values, "strikeouts")) pitcher.strikeouts = Math.max(0, Number(values.strikeouts || 0));
}

function normalizePlayerSettings(playerSettings) {
  if (!playerSettings || typeof playerSettings !== "object") return false;
  let changed = false;
  if (Object.hasOwn(playerSettings, "matchupEnabled")) {
    delete playerSettings.matchupEnabled;
    changed = true;
  }
  for (const side of [SIDES.AWAY, SIDES.HOME]) {
    if (!playerSettings[side]) {
      playerSettings[side] = createDefaultSidePlayers(side);
      changed = true;
    }
    changed = normalizePitcherList(playerSettings[side], side) || changed;
  }
  return changed;
}

function normalizePitcherList(sideSettings, side) {
  let changed = false;
  if (!Array.isArray(sideSettings.pitchers) || sideSettings.pitchers.length === 0) {
    sideSettings.pitchers = createDefaultSidePlayers(side).pitchers;
    return true;
  }
  const usedIds = new Set();
  sideSettings.pitchers.forEach((pitcher, index) => {
    let pitcherId = String(pitcher?.pitcherId || "").trim();
    if (!pitcherId || usedIds.has(pitcherId)) {
      do {
        pitcherId = createPitcherId();
      } while (usedIds.has(pitcherId));
      pitcher.pitcherId = pitcherId;
      changed = true;
    }
    usedIds.add(pitcherId);
    if (pitcher.order !== index + 1) {
      pitcher.order = index + 1;
      changed = true;
    }
  });
  return changed;
}

export function createPitcherId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `pitcher-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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

function ordinal(number) {
  const value = Number(number) || 0;
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
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
