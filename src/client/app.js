const app = document.querySelector("#app");
const viewerSettingsKey = "baseball-scoreboard.viewer";
const DEFAULT_BOARD_WIDTH = 520;
const BOARD_ASPECT_RATIO = 1200 / 560;
const MIN_BOARD_SCALE = 25;
const MAX_BOARD_SCALE = 300;

let state = { boards: [], settings: {}, presets: [] };
let selectedBoardId = null;
let selectedViewerBoardId = null;
let showEditMenu = false;
let showPlayerMenu = false;
let viewerSettings = loadViewerSettings();

start();

async function start() {
  await refreshState();
  connectEvents();
  window.addEventListener("hashchange", render);
  render();
}

async function refreshState() {
  state = await api("/api/state");
}

function connectEvents() {
  const events = new EventSource("/api/events");
  events.addEventListener("update", (event) => {
    const data = JSON.parse(event.data);
    state = data.state;
    render();
  });
  events.addEventListener("connected", (event) => {
    state = JSON.parse(event.data);
    render();
  });
}

function render() {
  const route = location.hash.replace(/^#/, "") || "/";
  if (route === "/") renderHome();
  else if (route === "/viewer") renderViewer();
  else if (route === "/control") renderControlList();
  else if (route.startsWith("/control/")) renderScoreInput(route.split("/")[2]);
  else if (route === "/settings") renderSettings();
  else renderHome();
}

function renderHome() {
  app.innerHTML = `
    <main class="home">
      <section class="home-panel">
        <h1>Baseball Scoreboard</h1>
        <div class="home-actions">
          <button class="primary" data-nav="/viewer">スコアボードを見る</button>
          <button class="primary" data-nav="/control">スコアボードを動かす</button>
        </div>
      </section>
    </main>
  `;
  bindNavigation();
}

function renderViewer() {
  const boards = state.boards || [];
  selectedViewerBoardId = resolveViewerBoardId(boards);
  const selectedTransform = selectedViewerBoardId ? getBoardTransform(selectedViewerBoardId) : defaultBoardTransform();
  document.body.style.background = viewerSettings.backgroundColor;
  app.innerHTML = `
    ${topBar("スコアボードを見る")}
    <main class="viewer-page">
      <section class="viewer-toolbar">
        <label>背景色 <input type="color" id="viewer-bg" value="${escapeHtml(viewerSettings.backgroundColor)}"></label>
        <label>位置対象
          <select id="viewer-position-board" ${boards.length ? "" : "disabled"}>
            ${boards.map((board) => `<option value="${escapeHtml(board.id)}" ${board.id === selectedViewerBoardId ? "selected" : ""}>${escapeHtml(board.name)}</option>`).join("")}
          </select>
        </label>
        <label>拡大率 <input type="range" id="viewer-scale" min="${MIN_BOARD_SCALE}" max="${MAX_BOARD_SCALE}" value="${selectedTransform.scale}" ${boards.length ? "" : "disabled"}><span id="viewer-scale-value">${selectedTransform.scale}%</span></label>
        <label>拡大率(%) <input type="number" id="viewer-scale-input" min="${MIN_BOARD_SCALE}" max="${MAX_BOARD_SCALE}" value="${selectedTransform.scale}" ${boards.length ? "" : "disabled"}></label>
        <label>サイズ(px) <input type="number" id="viewer-size-input" min="${scaleToBoardSize(MIN_BOARD_SCALE)}" max="${scaleToBoardSize(MAX_BOARD_SCALE)}" value="${scaleToBoardSize(selectedTransform.scale)}" ${boards.length ? "" : "disabled"}></label>
        <label>位置X <input type="number" id="viewer-x" value="${selectedTransform.x}" ${boards.length ? "" : "disabled"}></label>
        <label>位置Y <input type="number" id="viewer-y" value="${selectedTransform.y}" ${boards.length ? "" : "disabled"}></label>
        <button id="viewer-position-reset" ${boards.length ? "" : "disabled"}>表示リセット</button>
        <button id="viewer-export">表示設定を書き出し</button>
        <button id="viewer-import">表示設定を読み込み</button>
      </section>
      <section class="viewer-grid">
        ${boards.length ? boards.map(viewerBoardHtml).join("") : emptyState("稼働中のスコアボードがありません。")}
      </section>
    </main>
  `;
  bindNavigation();
  bindViewerToolbar();
  bindViewerBoardInteractions();
}

function renderControlList() {
  const boards = state.boards || [];
  document.body.style.background = "#f4f6f8";
  app.innerHTML = `
    ${topBar("スコアボードを動かす")}
    <main class="page">
      <section class="toolbar">
        <button class="primary" id="create-board">新規スコアボード作成</button>
        <button data-nav="/settings">設定画面を開く</button>
      </section>
      <section class="board-list">
        ${boards.length ? boards.map(boardCardHtml).join("") : emptyState("まだスコアボードがありません。")}
      </section>
    </main>
  `;
  bindNavigation();
  document.querySelector("#create-board")?.addEventListener("click", createBoard);
  document.querySelectorAll("[data-open-board]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `/control/${button.dataset.openBoard}`;
    });
  });
  document.querySelectorAll("[data-delete-board]").forEach((button) => {
    button.addEventListener("click", () => deleteBoard(button.dataset.deleteBoard));
  });
  document.querySelectorAll("[data-rename-board]").forEach((input) => {
    input.addEventListener("change", () => action(input.dataset.renameBoard, "board:rename", { name: input.value }));
  });
}

function renderScoreInput(boardId) {
  selectedBoardId = boardId;
  const board = getBoard(boardId);
  document.body.style.background = "#eef1f5";
  if (!board) {
    app.innerHTML = `${topBar("スコア入力")}<main class="page">${emptyState("スコアボードが見つかりません。")}</main>`;
    bindNavigation();
    return;
  }

  app.innerHTML = `
    ${topBar("スコア入力")}
    <main class="score-input-page">
      <section class="score-preview">
        ${scoreboardHtml(board)}
      </section>
      <section class="control-surface">
        ${controlGroup("投球", [
          button("ボール", "pitch:ball"),
          button("ストライク", "pitch:strike"),
          button("B -1", "count:balls", { delta: -1 }, "small"),
          button("B +1", "count:balls", { delta: 1 }, "small"),
          button("S -1", "count:strikes", { delta: -1 }, "small"),
          button("S +1", "count:strikes", { delta: 1 }, "small")
        ])}
        ${controlGroup("打席結果", [
          button("HR", "plate:result", { result: "homeRun" }),
          button("ヒット", "plate:result", { result: "hit" }),
          button("凡退", "plate:result", { result: "out" }),
          button("空三振", "plate:result", { result: "strikeoutSwinging" }),
          button("見三振", "plate:result", { result: "strikeoutLooking" }),
          button("その他", "plate:result", { result: "other" })
        ])}
        ${controlGroup("アウト", [
          button("アウト -1", "outs:adjust", { delta: -1 }),
          button("アウト +1", "outs:adjust", { delta: 1 }),
          button("走塁死", "outs:runningOut"),
          button("盗塁死", "outs:caughtStealing"),
          button("チェンジ", "inning:change", {}, board.gameState.outs === 3 ? "" : "disabled")
        ])}
        ${controlGroup("ランナー", [
          button(baseLabel("first", board), "runner:toggle", { base: "first" }),
          button(baseLabel("second", board), "runner:toggle", { base: "second" }),
          button(baseLabel("third", board), "runner:toggle", { base: "third" })
        ])}
        ${controlGroup("得点", [
          button("先攻 -1", "score:adjust", { side: "away", delta: -1 }),
          button("先攻 +1", "score:adjust", { side: "away", delta: 1 }),
          button("後攻 -1", "score:adjust", { side: "home", delta: -1 }),
          button("後攻 +1", "score:adjust", { side: "home", delta: 1 })
        ])}
        ${board.displayOptions.showAbs ? controlGroup("ABS", [
          button("先攻 ABS -1", "abs:adjust", { side: "away", delta: -1 }),
          button("先攻 ABS +1", "abs:adjust", { side: "away", delta: 1 }),
          button("後攻 ABS -1", "abs:adjust", { side: "home", delta: -1 }),
          button("後攻 ABS +1", "abs:adjust", { side: "home", delta: 1 })
        ]) : ""}
        ${controlGroup("履歴とメニュー", [
          button("戻る", "history:undo"),
          button("進む", "history:redo"),
          `<button id="toggle-edit">編集メニュー</button>`,
          `<button id="toggle-player">選手名メニュー</button>`
        ])}
      </section>
      ${showEditMenu ? editMenuHtml(board) : ""}
      ${showPlayerMenu ? playerMenuHtml(board) : ""}
    </main>
  `;
  bindNavigation();
  bindActionButtons(board.id);
  document.querySelector("#toggle-edit")?.addEventListener("click", () => {
    showEditMenu = !showEditMenu;
    render();
  });
  document.querySelector("#toggle-player")?.addEventListener("click", () => {
    showPlayerMenu = !showPlayerMenu;
    render();
  });
  bindEditMenu(board);
  bindPlayerMenu(board);
}

function renderSettings() {
  const settings = state.settings || {};
  document.body.style.background = "#f4f6f8";
  app.innerHTML = `
    ${topBar("設定")}
    <main class="page narrow">
      <section class="settings-panel">
        <h2>全体設定</h2>
        <label class="check-row"><input type="checkbox" id="auto-cleanup" ${settings.autoCleanupEnabled ? "checked" : ""}> 自動削除 ON/OFF</label>
        <label>自動削除までの時間 <input type="number" id="cleanup-hours" min="1" value="${settings.autoCleanupIdleHours || 24}"> 時間</label>
        <label>一時演出の表示秒数 <input type="number" id="overlay-seconds" min="1" value="${settings.overlayDisplaySeconds || 3}"> 秒</label>
        <button class="primary" id="save-settings">保存</button>
      </section>
      <section class="settings-panel">
        <h2>チームプリセット</h2>
        <p>プリセット作成、編集、削除は次の実装段階で詳細化します。</p>
      </section>
    </main>
  `;
  bindNavigation();
  document.querySelector("#save-settings")?.addEventListener("click", saveSettings);
}

function topBar(title) {
  return `
    <header class="topbar">
      <button data-nav="/">Home</button>
      <strong>${escapeHtml(title)}</strong>
      <nav>
        <button data-nav="/viewer">見る</button>
        <button data-nav="/control">動かす</button>
        <button data-nav="/settings">設定</button>
      </nav>
    </header>
  `;
}

function scoreboardHtml(board) {
  const state = board.gameState;
  const away = board.teamSettings.away;
  const home = board.teamSettings.home;
  const batter = currentBatter(board);
  const pitcher = currentPitcher(board);
  const showMatchup = board.displayOptions.showMatchup;
  const showAbs = board.displayOptions.showAbs;
  const overlay = activeOverlay(state.overlay);
  const attacking = state.inningHalf === "top" ? "away" : "home";
  const defending = defendingSide(state);
  const svgId = safeSvgId(board.id);
  const awayGradient = teamGradient(away.teamColor, "#ef2233");
  const homeGradient = teamGradient(home.teamColor, "#2c43e6");

  return `
    <article class="scoreboard">
      ${overlay ? `<div class="overlay ${overlay.reverse ? "reverse" : ""}">${escapeHtml(overlay.message)}</div>` : ""}
      <svg class="scoreboard-svg" viewBox="0 0 1200 560" role="img" aria-label="${escapeHtml(matchupSummary(board))}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="boardBg-${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#141b28"/>
            <stop offset="0.55" stop-color="#0d131d"/>
            <stop offset="1" stop-color="#070a11"/>
          </linearGradient>
          <linearGradient id="bezel-${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#525c70"/>
            <stop offset="0.5" stop-color="#2b3240"/>
            <stop offset="1" stop-color="#141922"/>
          </linearGradient>
          <linearGradient id="topBand-${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1a2331"/>
            <stop offset="1" stop-color="#111925"/>
          </linearGradient>
          <linearGradient id="awayBar-${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${awayGradient.light}"/>
            <stop offset="0.5" stop-color="${awayGradient.base}"/>
            <stop offset="1" stop-color="${awayGradient.dark}"/>
          </linearGradient>
          <linearGradient id="homeBar-${svgId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${homeGradient.light}"/>
            <stop offset="0.5" stop-color="${homeGradient.base}"/>
            <stop offset="1" stop-color="${homeGradient.dark}"/>
          </linearGradient>
          <linearGradient id="accent-${svgId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#38bdf8" stop-opacity="0"/>
            <stop offset="0.5" stop-color="#38bdf8" stop-opacity="0.9"/>
            <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="baseOn-${svgId}" cx="0.5" cy="0.4" r="0.7">
            <stop offset="0" stop-color="#ff6b76"/>
            <stop offset="0.5" stop-color="#ef2233"/>
            <stop offset="1" stop-color="#c1101f"/>
          </radialGradient>
          <filter id="glowW-${svgId}" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glowR-${svgId}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>
            .sb-text-${svgId} { font-family: "Bahnschrift", "DIN Alternate", "Segoe UI", "Yu Gothic", sans-serif; }
            .sb-name-${svgId} { font-size: 60px; font-weight: 600; fill: #eef4fd; }
            .sb-stat-${svgId} { font-size: 51px; font-weight: 600; fill: #93a3bb; }
            .sb-chip-${svgId} { font-size: 42px; font-weight: 700; fill: #ffffff; }
            .sb-abbr-${svgId} { font-weight: 700; letter-spacing: 0.5px; }
            .sb-score-${svgId} { font-size: 150px; font-weight: 700; }
            .sb-inn-${svgId} { font-size: 128px; font-weight: 700; fill: #ffffff; }
            .sb-count-${svgId} { font-size: 74px; font-weight: 700; fill: #f2f6ff; letter-spacing: 2px; }
          </style>
        </defs>

        <rect x="4" y="4" width="1192" height="552" rx="20" fill="url(#bezel-${svgId})"/>
        <rect x="6" y="5" width="1188" height="6" rx="3" fill="#6d778c" opacity="0.5"/>
        <rect x="13" y="13" width="1174" height="534" rx="12" fill="url(#boardBg-${svgId})"/>
        <rect x="13.75" y="13.75" width="1172.5" height="532.5" rx="11" fill="none" stroke="#38bdf8" stroke-opacity="0.18" stroke-width="1.5"/>

        <rect x="20" y="20" width="1160" height="170" rx="8" fill="url(#topBand-${svgId})"/>
        ${showMatchup ? matchupSvg(svgId, board, batter, pitcher, attacking, defending) : ""}
        <rect x="20" y="198" width="1160" height="2.5" rx="1.25" fill="url(#accent-${svgId})"/>

        ${inningSvg(svgId, state)}
        <line x1="150" y1="214" x2="150" y2="540" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>

        ${teamBarSvg(svgId, "away", away, state.score.away, showAbs ? state.abs.away : null)}
        ${teamBarSvg(svgId, "home", home, state.score.home, showAbs ? state.abs.home : null)}

        <line x1="980" y1="214" x2="980" y2="540" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
        ${basesSvg(svgId, state.runners)}
        <text class="sb-text-${svgId} sb-count-${svgId}" x="1084" y="425" text-anchor="middle">${state.balls}-${state.strikes}</text>
        ${outsSvg(svgId, state.outs)}
      </svg>
    </article>
  `;
}

function matchupSvg(svgId, board, batter, pitcher, attacking, defending) {
  return `
    <rect x="30" y="30" width="62" height="62" rx="11" fill="${escapeHtml(teamColor(board, attacking))}"/>
    <rect x="30" y="30" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14"/>
    <text class="sb-text-${svgId} sb-chip-${svgId}" x="61" y="74" text-anchor="middle">${escapeHtml(batterLabel(batter))}</text>
    <text class="sb-text-${svgId} sb-name-${svgId}" x="110" y="82">${escapeHtml(batter?.playerName || "N.Batter")}</text>
    <text class="sb-text-${svgId} sb-stat-${svgId}" x="1170" y="79" text-anchor="end">${escapeHtml(batterLine(batter))}</text>
    <line x1="30" y1="110" x2="1170" y2="110" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/>
    <rect x="30" y="120" width="62" height="62" rx="11" fill="${escapeHtml(teamColor(board, defending))}"/>
    <rect x="30" y="120" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14"/>
    <text class="sb-text-${svgId} sb-chip-${svgId}" x="61" y="164" text-anchor="middle">P</text>
    <text class="sb-text-${svgId} sb-name-${svgId}" x="110" y="172">${escapeHtml(pitcher?.pitcherName || "N.Pitcher")}</text>
    <text class="sb-text-${svgId} sb-stat-${svgId}" x="1170" y="169" text-anchor="end">P.${pitcher?.pitchCount || 0}</text>
  `;
}

function inningSvg(svgId, gameState) {
  const triangle = gameState.inningHalf === "top"
    ? "88,244 116,296 60,296"
    : "60,244 116,244 88,296";

  return `
    <polygon points="${triangle}" fill="#ffffff" filter="url(#glowW-${svgId})"/>
    <text class="sb-text-${svgId} sb-inn-${svgId}" x="88" y="421" text-anchor="middle" filter="url(#glowW-${svgId})">${gameState.inningNumber}</text>
  `;
}

function teamBarSvg(svgId, side, team, score, absCount) {
  const y = side === "away" ? 212 : 382;
  const logoCy = side === "away" ? 291 : 461;
  const textY = side === "away" ? 316 : 486;
  const scoreY = side === "away" ? 345 : 515;
  const dividerTop = side === "away" ? 226 : 396;
  const dividerBottom = side === "away" ? 356 : 526;
  const gradientId = side === "away" ? `awayBar-${svgId}` : `homeBar-${svgId}`;
  const label = team.abbreviation || team.name;

  return `
    <rect x="162" y="${y}" width="808" height="158" rx="13" fill="url(#${gradientId})"/>
    <rect x="162" y="${y}" width="808" height="79" rx="13" fill="#ffffff" opacity="0.10"/>
    ${absCount === null ? "" : absPipsSvg(absCount, y)}
    ${teamLogoSvg(team, 263, logoCy)}
    <text class="sb-text-${svgId} sb-abbr-${svgId}" x="343" y="${textY}" font-size="${teamLabelFontSize(label)}" fill="${escapeHtml(team.textColor || "#ffffff")}">${escapeHtml(label)}</text>
    <line x1="780" y1="${dividerTop}" x2="780" y2="${dividerBottom}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"/>
    <text class="sb-text-${svgId} sb-score-${svgId}" x="875" y="${scoreY}" text-anchor="middle" fill="${escapeHtml(team.textColor || "#ffffff")}" filter="url(#glowW-${svgId})">${score}</text>
  `;
}

function absPipsSvg(absCount, teamY) {
  const topY = teamY + 32;
  return Array.from({ length: 2 }, (_, index) => {
    const opacity = index < absCount ? "0.92" : "0.35";
    return `<rect x="174" y="${topY + index * 52}" width="13" height="42" rx="5" fill="#ffffff" opacity="${opacity}"/>`;
  }).join("");
}

function teamLogoSvg(team, cx, cy) {
  if (team.logoPath) {
    return `<image href="${escapeHtml(team.logoPath)}" x="${cx - 64}" y="${cy - 64}" width="128" height="128" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `
    <circle cx="${cx}" cy="${cy}" r="64" fill="#f6f7f9"/>
    <path d="M ${cx - 39} ${cy - 43} Q ${cx - 12} ${cy} ${cx - 39} ${cy + 43}" fill="none" stroke="#e11d2f" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M ${cx + 39} ${cy - 43} Q ${cx + 12} ${cy} ${cx + 39} ${cy + 43}" fill="none" stroke="#e11d2f" stroke-width="4.5" stroke-linecap="round"/>
  `;
}

function basesSvg(svgId, runners) {
  return `
    ${baseDiamondSvg(svgId, "1084,220 1114,250 1084,280 1054,250", runners.second)}
    ${baseDiamondSvg(svgId, "1128,264 1158,294 1128,324 1098,294", runners.first)}
    ${baseDiamondSvg(svgId, "1040,264 1070,294 1040,324 1010,294", runners.third)}
  `;
}

function baseDiamondSvg(svgId, points, active) {
  if (active) {
    return `<polygon points="${points}" fill="url(#baseOn-${svgId})" stroke="#ff707b" stroke-width="2" filter="url(#glowR-${svgId})"/>`;
  }
  return `<polygon points="${points}" fill="#141b26" stroke="#47546c" stroke-width="3"/>`;
}

function outsSvg(svgId, outs) {
  return [1034, 1084, 1134].map((cx, index) => {
    if (index < outs) {
      return `<circle cx="${cx}" cy="492" r="20" fill="url(#baseOn-${svgId})" filter="url(#glowR-${svgId})"/>`;
    }
    return `<circle cx="${cx}" cy="492" r="20" fill="#141b26" stroke="#47546c" stroke-width="3.5"/>`;
  }).join("");
}

function boardCardHtml(board) {
  return `
    <article class="board-card">
      <div class="board-card-main">
        <strong>${escapeHtml(board.name)}</strong>
        <span>${escapeHtml(matchupSummary(board))}</span>
      </div>
      <div class="card-actions">
        <input data-rename-board="${board.id}" value="${escapeHtml(board.name)}" aria-label="スコアボード名">
        <button class="primary" data-open-board="${board.id}">選択</button>
        <button class="danger" data-delete-board="${board.id}">削除</button>
      </div>
    </article>
  `;
}

function editMenuHtml(board) {
  return `
    <aside class="side-panel">
      <h2>編集メニュー</h2>
      <label>スコアボード名 <input id="edit-board-name" value="${escapeHtml(board.name)}"></label>
      ${teamEditHtml("away", board.teamSettings.away)}
      ${teamEditHtml("home", board.teamSettings.home)}
      <label class="check-row"><input type="checkbox" id="show-abs" ${board.displayOptions.showAbs ? "checked" : ""}> ABS表示</label>
      <label class="check-row"><input type="checkbox" id="show-matchup" ${board.displayOptions.showMatchup ? "checked" : ""}> 対戦選手表示</label>
      <button class="primary" id="save-edit-menu">保存</button>
    </aside>
  `;
}

function teamEditHtml(side, team) {
  const label = side === "away" ? "先攻" : "後攻";
  return `
    <fieldset>
      <legend>${label}</legend>
      <label>略称 <input id="${side}-abbr" value="${escapeHtml(team.abbreviation)}"></label>
      <label>チーム色 <input type="color" id="${side}-color" value="${escapeHtml(team.teamColor)}"></label>
      <label>文字色 <input type="color" id="${side}-text" value="${escapeHtml(team.textColor)}"></label>
      <label>ロゴ画像 <input type="file" id="${side}-logo-file" accept="image/png,image/jpeg"></label>
      <input type="hidden" id="${side}-logo" value="${escapeHtml(team.logoPath || "")}">
      <div class="logo-upload-row">
        <span id="${side}-logo-status">${team.logoPath ? "設定済み" : "未設定"}</span>
        <button type="button" class="small" data-clear-logo="${side}">ロゴ削除</button>
      </div>
      <div class="logo-preview" id="${side}-logo-preview">${logoPreviewHtml(team.logoPath)}</div>
    </fieldset>
  `;
}

function logoPreviewHtml(logoPath) {
  return logoPath ? `<img src="${escapeHtml(logoPath)}" alt="">` : "";
}

function playerMenuHtml(board) {
  return `
    <aside class="side-panel player-panel">
      <h2>選手名メニュー</h2>
      ${playerSideHtml("away", board)}
      ${playerSideHtml("home", board)}
      <button class="primary" id="save-player-menu">保存</button>
    </aside>
  `;
}

function playerSideHtml(side, board) {
  const label = side === "away" ? "先攻" : "後攻";
  const players = board.playerSettings[side].battingOrder;
  const pitchers = normalizePitchersForView(board.playerSettings[side].pitchers, side);
  return `
    <fieldset>
      <legend>${label}</legend>
      <div class="player-grid">
        ${players.map((player, index) => `
          <label>${index + 1}
            <input data-player="${side}:${index}:name" value="${escapeHtml(player.playerName)}">
            <input class="pos" data-player="${side}:${index}:position" value="${escapeHtml(player.position || "")}" placeholder="POS">
            <span><input type="checkbox" data-player="${side}:${index}:ph" ${player.isPinchHitter ? "checked" : ""}> PH</span>
          </label>
        `).join("")}
      </div>
      <section class="pitcher-editor" data-pitchers-side="${side}">
        <div class="pitcher-editor-head">
          <strong>ピッチャー一覧</strong>
          <button type="button" class="small" data-add-pitcher="${side}">ピッチャー追加</button>
        </div>
        <div class="pitcher-list" data-pitcher-list="${side}">
          ${pitchers.map((pitcher, index) => pitcherRowHtml(side, pitcher, index, index === pitchers.length - 1)).join("")}
        </div>
      </section>
    </fieldset>
  `;
}

function pitcherRowHtml(side, pitcher, index, isCurrent) {
  return `
    <label class="pitcher-row">
      <span>${isCurrent ? "現在" : index + 1}</span>
      <input data-pitcher="${side}:${index}:name" value="${escapeHtml(pitcher.pitcherName || "")}">
      <input type="number" min="0" data-pitcher="${side}:${index}:pitchCount" value="${Math.max(0, Number(pitcher.pitchCount || 0))}">
    </label>
  `;
}

function controlGroup(title, controls) {
  return `
    <section class="control-group">
      <h2>${title}</h2>
      <div class="button-grid">${controls.join("")}</div>
    </section>
  `;
}

function button(label, type, payload = {}, extraClass = "") {
  const disabled = extraClass.includes("disabled") ? "disabled" : "";
  return `<button class="${extraClass}" data-action="${type}" data-payload="${escapeHtml(JSON.stringify(payload))}" ${disabled}>${label}</button>`;
}

function bindActionButtons(boardId) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const payload = JSON.parse(button.dataset.payload || "{}");
      action(boardId, button.dataset.action, payload);
    });
  });
}

function bindNavigation() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = button.dataset.nav;
    });
  });
}

function bindViewerToolbar() {
  const bg = document.querySelector("#viewer-bg");
  const scale = document.querySelector("#viewer-scale");
  const scaleInput = document.querySelector("#viewer-scale-input");
  const sizeInput = document.querySelector("#viewer-size-input");
  const boardSelect = document.querySelector("#viewer-position-board");
  const posX = document.querySelector("#viewer-x");
  const posY = document.querySelector("#viewer-y");
  bg?.addEventListener("input", () => {
    viewerSettings = persistViewerSettings({ backgroundColor: bg.value });
    document.body.style.background = viewerSettings.backgroundColor;
  });
  scale?.addEventListener("input", () => {
    updateSelectedBoardTransform({ scale: Number(scale.value) });
  });
  scaleInput?.addEventListener("input", () => {
    if (scaleInput.value.trim() === "") return;
    updateSelectedBoardTransform({ scale: Number(scaleInput.value) });
  });
  sizeInput?.addEventListener("input", () => {
    if (sizeInput.value.trim() === "") return;
    updateSelectedBoardTransform({ scale: boardSizeToScale(Number(sizeInput.value)) });
  });
  boardSelect?.addEventListener("change", () => {
    selectViewerBoard(boardSelect.value);
  });
  posX?.addEventListener("input", () => updateSelectedBoardTransform({ x: Number(posX.value) }));
  posY?.addEventListener("input", () => updateSelectedBoardTransform({ y: Number(posY.value) }));
  document.querySelector("#viewer-position-reset")?.addEventListener("click", () => {
    resetSelectedBoardTransform();
  });
  document.querySelector("#viewer-export")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(JSON.stringify(viewerSettings, null, 2));
    alert("表示設定をクリップボードへ書き出しました。");
  });
  document.querySelector("#viewer-import")?.addEventListener("click", () => {
    const raw = prompt("表示設定のJSONを貼り付けてください。");
    if (!raw) return;
    try {
      updateViewerSettings(JSON.parse(raw));
    } catch {
      alert("読み込めませんでした。");
    }
  });
}

function bindViewerBoardInteractions() {
  document.querySelectorAll("[data-viewer-board]").forEach((board) => {
    board.addEventListener("pointerdown", startViewerBoardPointer);
  });
}

function startViewerBoardPointer(event) {
  if (event.button !== 0) return;
  const boardElement = event.currentTarget;
  const boardId = boardElement.dataset.viewerBoard;
  const resizeHandle = resolveViewerResizeHandle(event, boardElement);
  const start = getBoardTransform(boardId);
  const startVisualWidth = scaleToBoardSize(start.scale);
  const startVisualHeight = startVisualWidth / BOARD_ASPECT_RATIO;
  const startRight = start.x + startVisualWidth;
  const startBottom = start.y + startVisualHeight;
  const startPointer = { x: event.clientX, y: event.clientY };

  event.preventDefault();
  selectViewerBoard(boardId);
  boardElement.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => {
    const dx = moveEvent.clientX - startPointer.x;
    const dy = moveEvent.clientY - startPointer.y;
    if (resizeHandle) {
      setBoardTransform(boardId, resizeTransformFromPointer(resizeHandle, start, startVisualWidth, startRight, startBottom, dx, dy));
    } else {
      setBoardTransform(boardId, {
        x: Math.round(start.x + dx),
        y: Math.round(start.y + dy),
        scale: start.scale
      });
    }
  };

  const onEnd = () => {
    boardElement.removeEventListener("pointermove", onMove);
    boardElement.removeEventListener("pointerup", onEnd);
    boardElement.removeEventListener("pointercancel", onEnd);
  };

  boardElement.addEventListener("pointermove", onMove);
  boardElement.addEventListener("pointerup", onEnd);
  boardElement.addEventListener("pointercancel", onEnd);
}

function resolveViewerResizeHandle(event, boardElement) {
  const explicitHandle = event.target instanceof Element
    ? event.target.closest("[data-resize-handle]")?.dataset.resizeHandle
    : "";
  if (explicitHandle) return explicitHandle;

  const rect = boardElement.getBoundingClientRect();
  const edgeSize = 18;
  const nearLeft = event.clientX - rect.left <= edgeSize;
  const nearRight = rect.right - event.clientX <= edgeSize;
  const nearTop = event.clientY - rect.top <= edgeSize;
  const nearBottom = rect.bottom - event.clientY <= edgeSize;

  if (nearTop && nearLeft) return "nw";
  if (nearTop && nearRight) return "ne";
  if (nearBottom && nearLeft) return "sw";
  if (nearBottom && nearRight) return "se";
  if (nearTop) return "n";
  if (nearRight) return "e";
  if (nearBottom) return "s";
  if (nearLeft) return "w";
  return "";
}

function resizeTransformFromPointer(handle, start, startVisualWidth, startRight, startBottom, dx, dy) {
  const horizontalDelta = handle.includes("e") ? dx : handle.includes("w") ? -dx : 0;
  const verticalDelta = handle.includes("s") ? dy * BOARD_ASPECT_RATIO : handle.includes("n") ? -dy * BOARD_ASPECT_RATIO : 0;
  const widthDelta = Math.abs(horizontalDelta) >= Math.abs(verticalDelta) ? horizontalDelta : verticalDelta;
  const scale = clampScale(((startVisualWidth + widthDelta) / DEFAULT_BOARD_WIDTH) * 100);
  const nextWidth = scaleToBoardSize(scale);
  const nextHeight = nextWidth / BOARD_ASPECT_RATIO;
  return {
    x: handle.includes("w") ? Math.round(startRight - nextWidth) : start.x,
    y: handle.includes("n") ? Math.round(startBottom - nextHeight) : start.y,
    scale
  };
}

function bindEditMenu(board) {
  bindLogoInputs();
  document.querySelector("#save-edit-menu")?.addEventListener("click", async () => {
    const boardName = document.querySelector("#edit-board-name").value;
    const teamUpdates = {};
    for (const side of ["away", "home"]) {
      const logoPath = await resolveLogoPathForSave(side);
      teamUpdates[side] = {
        abbreviation: document.querySelector(`#${side}-abbr`).value,
        teamColor: document.querySelector(`#${side}-color`).value,
        textColor: document.querySelector(`#${side}-text`).value,
        logoPath
      };
    }
    const displayOptions = {
      showAbs: document.querySelector("#show-abs").checked,
      showMatchup: document.querySelector("#show-matchup").checked
    };

    await action(board.id, "board:rename", { name: boardName });
    for (const side of ["away", "home"]) {
      await action(board.id, "team:update", { side, values: teamUpdates[side] });
    }
    await action(board.id, "display:update", displayOptions);
  });
}

function bindLogoInputs() {
  document.querySelectorAll("[id$='-logo-file']").forEach((input) => {
    input.addEventListener("change", async () => {
      const side = input.id.replace(/-logo-file$/, "");
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await createLogoDataUrl(file);
        const logoInput = document.querySelector(`#${side}-logo`);
        logoInput.dataset.pendingLogo = dataUrl;
        logoInput.value = "";
        document.querySelector(`#${side}-logo-status`).textContent = "選択済み";
        document.querySelector(`#${side}-logo-preview`).innerHTML = `<img src="${dataUrl}" alt="">`;
      } catch (error) {
        input.value = "";
        alert(error.message || "ロゴ画像を読み込めませんでした。");
      }
    });
  });
  document.querySelectorAll("[data-clear-logo]").forEach((button) => {
    button.addEventListener("click", () => {
      const side = button.dataset.clearLogo;
      const logoInput = document.querySelector(`#${side}-logo`);
      const fileInput = document.querySelector(`#${side}-logo-file`);
      logoInput.value = "";
      delete logoInput.dataset.pendingLogo;
      if (fileInput) fileInput.value = "";
      document.querySelector(`#${side}-logo-status`).textContent = "未設定";
      document.querySelector(`#${side}-logo-preview`).innerHTML = "";
    });
  });
}

async function resolveLogoPathForSave(side) {
  const logoInput = document.querySelector(`#${side}-logo`);
  if (!logoInput?.dataset.pendingLogo) return logoInput?.value || "";
  const result = await api("/api/uploads/team-logo", {
    method: "POST",
    body: JSON.stringify({ dataUrl: logoInput.dataset.pendingLogo })
  });
  logoInput.value = result.logoPath;
  delete logoInput.dataset.pendingLogo;
  return result.logoPath;
}

function createLogoDataUrl(file) {
  const mimeType = detectLogoMimeType(file);
  if (!mimeType) {
    return Promise.reject(new Error("PNGまたはJPEG画像を選択してください。"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("error", () => reject(new Error("画像を読み込めませんでした。")));
      image.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を変換できませんでした。"));
          return;
        }
        if (mimeType === "image/jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mimeType === "image/png" ? "image/png" : "image/jpeg", 0.86));
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  });
}

function detectLogoMimeType(file) {
  if (["image/png", "image/jpeg"].includes(file.type)) return file.type;
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

function bindPlayerMenu(board) {
  document.querySelector("#save-player-menu")?.addEventListener("click", async () => {
    const next = structuredClone(board.playerSettings);
    document.querySelectorAll("[data-player]").forEach((input) => {
      const [side, indexText, field] = input.dataset.player.split(":");
      const player = next[side].battingOrder[Number(indexText)];
      if (field === "name") player.playerName = input.value;
      if (field === "position") player.position = input.value;
      if (field === "ph") player.isPinchHitter = input.checked;
    });
    for (const side of ["away", "home"]) {
      next[side].pitchers = collectPitchersFromDom(side);
    }
    await action(board.id, "players:update", next);
  });
  document.querySelectorAll("[data-add-pitcher]").forEach((button) => {
    button.addEventListener("click", () => addPitcherRow(button.dataset.addPitcher));
  });
}

function addPitcherRow(side) {
  const list = document.querySelector(`[data-pitcher-list="${side}"]`);
  if (!list) return;
  const pitchers = collectPitchersFromDom(side);
  pitchers.push({
    pitcherName: defaultPitcherName(side, pitchers.length + 1),
    pitchCount: 0,
    order: pitchers.length + 1
  });
  list.innerHTML = pitchers
    .map((pitcher, index) => pitcherRowHtml(side, pitcher, index, index === pitchers.length - 1))
    .join("");
}

function collectPitchersFromDom(side) {
  const pitchers = [];
  document.querySelectorAll(`[data-pitcher-list="${side}"] [data-pitcher]`).forEach((input) => {
    const [, indexText, field] = input.dataset.pitcher.split(":");
    const index = Number(indexText);
    if (!Number.isInteger(index)) return;
    pitchers[index] ||= { pitcherName: "", pitchCount: 0, order: index + 1 };
    if (field === "name") pitchers[index].pitcherName = input.value;
    if (field === "pitchCount") pitchers[index].pitchCount = Math.max(0, Number(input.value || 0));
  });
  return normalizePitchersForView(pitchers, side);
}

function normalizePitchersForView(pitchers, side) {
  const normalized = (Array.isArray(pitchers) ? pitchers : [])
    .map((pitcher, index) => ({
      pitcherName: String(pitcher?.pitcherName || defaultPitcherName(side, index + 1)),
      pitchCount: Math.max(0, Number(pitcher?.pitchCount || 0)),
      order: Number.isFinite(Number(pitcher?.order)) ? Number(pitcher.order) : index + 1
    }));
  return normalized.length ? normalized : [{ pitcherName: defaultPitcherName(side, 1), pitchCount: 0, order: 1 }];
}

function defaultPitcherName(side, order) {
  const label = side === "away" ? "A" : "B";
  return `${label}.Pitcher${order}`;
}

async function createBoard() {
  const board = await api("/api/boards", {
    method: "POST",
    body: JSON.stringify({ name: `Scoreboard ${state.boards.length + 1}` })
  });
  await refreshState();
  location.hash = `/control/${board.id}`;
}

async function deleteBoard(boardId) {
  const board = getBoard(boardId);
  if (!confirm(`「${board?.name || "スコアボード"}」を削除しますか？`)) return;
  await api(`/api/boards/${encodeURIComponent(boardId)}`, { method: "DELETE" });
  await refreshState();
  render();
}

async function action(boardId, type, payload = {}) {
  const result = await api(`/api/boards/${encodeURIComponent(boardId)}/action`, {
    method: "POST",
    body: JSON.stringify({ type, payload })
  });
  const index = state.boards.findIndex((board) => board.id === result.id);
  if (index !== -1) state.boards[index] = result;
  render();
}

async function saveSettings() {
  const settings = await api("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({
      autoCleanupEnabled: document.querySelector("#auto-cleanup").checked,
      autoCleanupIdleHours: Number(document.querySelector("#cleanup-hours").value),
      overlayDisplaySeconds: Number(document.querySelector("#overlay-seconds").value)
    })
  });
  state.settings = settings;
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "エラーが発生しました。");
    throw new Error(data.error || "API error");
  }
  return data;
}

function getBoard(id) {
  return (state.boards || []).find((board) => board.id === id);
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function viewerBoardHtml(board) {
  const transform = getBoardTransform(board.id);
  const selectedClass = board.id === selectedViewerBoardId ? " selected" : "";
  return `
    <div class="viewer-board${selectedClass}" data-viewer-board="${escapeHtml(board.id)}" style="--viewer-x:${transform.x}px; --viewer-y:${transform.y}px; --viewer-scale:${transform.scale / 100}; --viewer-z:${getBoardZIndex(board.id)}; --board-width:${DEFAULT_BOARD_WIDTH}px;">
      ${resizeHandlesHtml()}
      ${scoreboardHtml(board)}
    </div>
  `;
}

function resizeHandlesHtml() {
  return ["n", "e", "s", "w", "ne", "se", "sw", "nw"]
    .map((handle) => `<span class="viewer-resize-handle ${handle}" data-resize-handle="${handle}"></span>`)
    .join("");
}

function updateViewerSettings(next) {
  viewerSettings = persistViewerSettings(next);
  render();
}

function persistViewerSettings(next) {
  const updated = normalizeViewerSettings({
    ...viewerSettings,
    ...next
  });
  localStorage.setItem(viewerSettingsKey, JSON.stringify(updated));
  return updated;
}

function loadViewerSettings() {
  try {
    return normalizeViewerSettings(JSON.parse(localStorage.getItem(viewerSettingsKey) || "{}"));
  } catch {
    return defaultViewerSettings();
  }
}

function resolveViewerBoardId(boards) {
  if (!boards.length) return null;
  if (selectedViewerBoardId && boards.some((board) => board.id === selectedViewerBoardId)) {
    return selectedViewerBoardId;
  }
  return boards[0].id;
}

function updateSelectedBoardTransform(next) {
  if (!selectedViewerBoardId) return;
  setBoardTransform(selectedViewerBoardId, next);
}

function resetSelectedBoardTransform() {
  if (!selectedViewerBoardId) return;
  setBoardTransform(selectedViewerBoardId, defaultBoardTransform());
}

function selectViewerBoard(boardId) {
  selectedViewerBoardId = boardId;
  document.querySelectorAll("[data-viewer-board]").forEach((board) => {
    board.classList.toggle("selected", board.dataset.viewerBoard === boardId);
  });
  const boardSelect = document.querySelector("#viewer-position-board");
  if (boardSelect) boardSelect.value = boardId;
  syncViewerTransformInputs();
}

function syncViewerTransformInputs() {
  const transform = selectedViewerBoardId ? getBoardTransform(selectedViewerBoardId) : defaultBoardTransform();
  const scale = Math.round(transform.scale);
  const posX = document.querySelector("#viewer-x");
  const posY = document.querySelector("#viewer-y");
  const scaleRange = document.querySelector("#viewer-scale");
  const scaleInput = document.querySelector("#viewer-scale-input");
  const scaleValue = document.querySelector("#viewer-scale-value");
  const sizeInput = document.querySelector("#viewer-size-input");
  if (posX) posX.value = String(Math.round(transform.x));
  if (posY) posY.value = String(Math.round(transform.y));
  if (scaleRange) scaleRange.value = String(scale);
  if (scaleInput) scaleInput.value = String(scale);
  if (scaleValue) scaleValue.textContent = `${scale}%`;
  if (sizeInput) sizeInput.value = String(scaleToBoardSize(scale));
}

function applyBoardTransform(boardId) {
  const transform = getBoardTransform(boardId);
  const element = document.querySelector(`[data-viewer-board="${cssEscape(boardId)}"]`);
  element?.style.setProperty("--viewer-x", `${transform.x}px`);
  element?.style.setProperty("--viewer-y", `${transform.y}px`);
  element?.style.setProperty("--viewer-scale", String(transform.scale / 100));
  element?.style.setProperty("--viewer-z", String(getBoardZIndex(boardId)));
  if (boardId === selectedViewerBoardId) syncViewerTransformInputs();
}

function applyViewerStackOrder() {
  document.querySelectorAll("[data-viewer-board]").forEach((element) => {
    element.style.setProperty("--viewer-z", String(getBoardZIndex(element.dataset.viewerBoard)));
  });
}

function setBoardTransform(boardId, next) {
  const current = getBoardTransform(boardId);
  const transform = {
    x: Number.isFinite(next.x) ? next.x : current.x,
    y: Number.isFinite(next.y) ? next.y : current.y,
    scale: clampScale(Number.isFinite(next.scale) ? next.scale : current.scale)
  };
  viewerSettings = persistViewerSettings({
    boardPositions: {
      ...(viewerSettings.boardPositions || {}),
      [boardId]: { x: transform.x, y: transform.y }
    },
    boardScales: {
      ...(viewerSettings.boardScales || {}),
      [boardId]: transform.scale
    },
    boardStackOrder: bumpBoardStackOrder(boardId)
  });
  applyBoardTransform(boardId);
  applyViewerStackOrder();
}

function getBoardTransform(boardId) {
  const position = viewerSettings.boardPositions?.[boardId] || {};
  return {
    x: numberOrDefault(position.x, 0),
    y: numberOrDefault(position.y, 0),
    scale: getBoardScale(boardId)
  };
}

function getBoardScale(boardId) {
  return clampScale(numberOrDefault(viewerSettings.boardScales?.[boardId], viewerSettings.defaultScale));
}

function defaultBoardTransform() {
  return { x: 0, y: 0, scale: viewerSettings.defaultScale || 100 };
}

function defaultViewerSettings() {
  return {
    backgroundColor: "#ffffff",
    defaultScale: 100,
    boardPositions: {},
    boardScales: {},
    boardStackOrder: []
  };
}

function normalizeViewerSettings(raw) {
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

function bumpBoardStackOrder(boardId) {
  return [...(viewerSettings.boardStackOrder || []).filter((id) => id !== boardId), boardId];
}

function getBoardZIndex(boardId) {
  const index = (viewerSettings.boardStackOrder || []).indexOf(boardId);
  return index === -1 ? 1 : index + 2;
}

function scaleToBoardSize(scale) {
  return Math.round((DEFAULT_BOARD_WIDTH * clampScale(scale)) / 100);
}

function boardSizeToScale(size) {
  return (numberOrDefault(size, DEFAULT_BOARD_WIDTH) / DEFAULT_BOARD_WIDTH) * 100;
}

function clampScale(scale) {
  return Math.max(MIN_BOARD_SCALE, Math.min(MAX_BOARD_SCALE, numberOrDefault(scale, 100)));
}

function currentBatter(board) {
  const side = board.gameState.inningHalf === "top" ? "away" : "home";
  const index = board.playerSettings.currentBattingOrderIndex[side] || 0;
  return board.playerSettings[side].battingOrder[index];
}

function currentPitcher(board) {
  const side = defendingSide(board.gameState);
  const pitchers = board.playerSettings[side].pitchers;
  return pitchers[pitchers.length - 1];
}

function defendingSide(gameState) {
  return gameState.inningHalf === "top" ? "home" : "away";
}

function teamColor(board, side) {
  return board.teamSettings[side].teamColor;
}

function safeSvgId(value) {
  return `sb-${String(value || "board").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function teamGradient(color, fallback) {
  const base = normalizeHexColor(color) || fallback;
  return {
    light: adjustHexColor(base, 28),
    base,
    dark: adjustHexColor(base, -46)
  };
}

function teamLabelFontSize(label) {
  const weight = Array.from(String(label || "")).reduce((sum, char) => {
    return sum + (/^[\x00-\x7F]$/.test(char) ? 0.62 : 1);
  }, 0);
  if (!weight) return 70;
  return Math.max(44, Math.min(70, Math.floor(420 / weight)));
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const short = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    return `#${short[1].split("").map((char) => char + char).join("")}`.toLowerCase();
  }
  const full = raw.match(/^#([0-9a-fA-F]{6})$/);
  return full ? `#${full[1].toLowerCase()}` : null;
}

function adjustHexColor(hex, amount) {
  const normalized = normalizeHexColor(hex) || "#000000";
  const channels = [1, 3, 5].map((start) => {
    const current = parseInt(normalized.slice(start, start + 2), 16);
    return Math.max(0, Math.min(255, current + amount));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function batterLabel(batter) {
  if (!batter) return "1";
  return batter.isPinchHitter ? "PH" : String(batter.battingOrderNumber);
}

function batterLine(batter) {
  if (!batter) return "0-0";
  const hits = (batter.homeRuns || 0) + (batter.hits || 0);
  const atBats = (batter.homeRuns || 0) + (batter.hits || 0) + (batter.strikeoutsSwinging || 0) + (batter.strikeoutsLooking || 0) + (batter.outs || 0);
  return `${hits}-${atBats}`;
}

function matchupSummary(board) {
  const gameState = board.gameState;
  const away = board.teamSettings.away;
  const home = board.teamSettings.home;
  const inningHalf = gameState.inningHalf === "top" ? "表" : "裏";
  return `${away.abbreviation || away.name} ${gameState.score.away}-${gameState.score.home} ${home.abbreviation || home.name} ${gameState.inningNumber}回${inningHalf}`;
}

function activeOverlay(overlay) {
  if (!overlay) return null;
  return overlay.expiresAt > Date.now() ? overlay : null;
}

function baseLabel(base, board) {
  const labels = { first: "一塁", second: "二塁", third: "三塁" };
  return `${labels[base]} ${board.gameState.runners[base] ? "ON" : "OFF"}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
