const app = document.querySelector("#app");
const viewerSettingsKey = "baseball-scoreboard.viewer";

let state = { boards: [], settings: {}, presets: [] };
let selectedBoardId = null;
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
  document.body.style.background = viewerSettings.backgroundColor;
  app.innerHTML = `
    ${topBar("スコアボードを見る")}
    <main class="viewer-page">
      <section class="viewer-toolbar">
        <label>背景色 <input type="color" id="viewer-bg" value="${escapeHtml(viewerSettings.backgroundColor)}"></label>
        <label>拡大率 <input type="range" id="viewer-scale" min="50" max="200" value="${viewerSettings.scale}"><span>${viewerSettings.scale}%</span></label>
        <label>サイズ <input type="range" id="viewer-size" min="260" max="900" value="${viewerSettings.boardWidth}"><span>${viewerSettings.boardWidth}px</span></label>
        <button id="viewer-export">表示設定を書き出し</button>
        <button id="viewer-import">表示設定を読み込み</button>
      </section>
      <section class="viewer-grid" style="--viewer-scale:${viewerSettings.scale / 100}; --board-width:${viewerSettings.boardWidth}px;">
        ${boards.length ? boards.map((board) => `<div class="viewer-board">${scoreboardHtml(board)}</div>`).join("") : emptyState("稼働中のスコアボードがありません。")}
      </section>
    </main>
  `;
  bindNavigation();
  bindViewerToolbar();
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
      <label>ロゴURL <input id="${side}-logo" value="${escapeHtml(team.logoPath || "")}"></label>
    </fieldset>
  `;
}

function playerMenuHtml(board) {
  return `
    <aside class="side-panel player-panel">
      <h2>選手名メニュー</h2>
      <p>現在のピッチャーは各チームの最後の入力欄です。</p>
      ${playerSideHtml("away", board)}
      ${playerSideHtml("home", board)}
      <button class="primary" id="save-player-menu">保存</button>
    </aside>
  `;
}

function playerSideHtml(side, board) {
  const label = side === "away" ? "先攻" : "後攻";
  const players = board.playerSettings[side].battingOrder;
  const pitchers = board.playerSettings[side].pitchers;
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
      <label>ピッチャー
        <input data-pitcher="${side}:0" value="${escapeHtml(pitchers[pitchers.length - 1]?.pitcherName || "")}">
      </label>
    </fieldset>
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
  const size = document.querySelector("#viewer-size");
  bg?.addEventListener("input", () => {
    viewerSettings = persistViewerSettings({ backgroundColor: bg.value });
    document.body.style.background = viewerSettings.backgroundColor;
  });
  scale?.addEventListener("input", () => updateViewerSettings({ scale: Number(scale.value) }));
  size?.addEventListener("input", () => updateViewerSettings({ boardWidth: Number(size.value) }));
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

function bindEditMenu(board) {
  document.querySelector("#save-edit-menu")?.addEventListener("click", async () => {
    await action(board.id, "board:rename", { name: document.querySelector("#edit-board-name").value });
    for (const side of ["away", "home"]) {
      await action(board.id, "team:update", {
        side,
        values: {
          abbreviation: document.querySelector(`#${side}-abbr`).value,
          teamColor: document.querySelector(`#${side}-color`).value,
          textColor: document.querySelector(`#${side}-text`).value,
          logoPath: document.querySelector(`#${side}-logo`).value
        }
      });
    }
    await action(board.id, "display:update", {
      showAbs: document.querySelector("#show-abs").checked,
      showMatchup: document.querySelector("#show-matchup").checked
    });
  });
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
    document.querySelectorAll("[data-pitcher]").forEach((input) => {
      const [side] = input.dataset.pitcher.split(":");
      const pitchers = next[side].pitchers;
      pitchers[pitchers.length - 1].pitcherName = input.value;
    });
    await action(board.id, "players:update", next);
  });
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

function updateViewerSettings(next) {
  viewerSettings = persistViewerSettings(next);
  render();
}

function persistViewerSettings(next) {
  const updated = {
    ...viewerSettings,
    ...next
  };
  localStorage.setItem(viewerSettingsKey, JSON.stringify(updated));
  return updated;
}

function loadViewerSettings() {
  try {
    return {
      backgroundColor: "#ffffff",
      scale: 100,
      boardWidth: 520,
      ...JSON.parse(localStorage.getItem(viewerSettingsKey) || "{}")
    };
  } catch {
    return { backgroundColor: "#ffffff", scale: 100, boardWidth: 520 };
  }
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
