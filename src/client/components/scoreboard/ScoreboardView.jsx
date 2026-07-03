// @ts-check
import { useEffect, useState } from "react";

/**
 * スコアボード本体（表示専用）。
 * Broadcast LEDデザインのSVG構造をJSXで描画する。
 * @param {{ board: any }} props
 */
export default function ScoreboardView({ board }) {
  const state = board.gameState;
  const [, refreshOverlay] = useState(0);
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

  useEffect(() => {
    const expiresAt = Number(state.overlay?.expiresAt || 0);
    if (!expiresAt) return undefined;
    const timeout = window.setTimeout(
      () => refreshOverlay((current) => current + 1),
      Math.max(0, expiresAt - Date.now()) + 25
    );
    return () => window.clearTimeout(timeout);
  }, [state.overlay?.expiresAt]);

  return (
    <article className={`scoreboard${showMatchup ? "" : " no-matchup"}`}>
      {overlay ? (
        <div className={`overlay${overlay.kind === "strikeout" ? " strikeout" : ""}${overlay.reverse ? " reverse" : ""}`}>
          {overlay.message}
        </div>
      ) : null}
      <svg
        className="scoreboard-svg"
        viewBox={showMatchup ? "0 0 1040 560" : "0 198 1040 362"}
        role="img"
        aria-label={matchupSummary(board)}
      >
        <defs>
          <linearGradient id={`boardBg-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141b28" />
            <stop offset="0.55" stopColor="#0d131d" />
            <stop offset="1" stopColor="#070a11" />
          </linearGradient>
          <linearGradient id={`bezel-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#525c70" />
            <stop offset="0.5" stopColor="#2b3240" />
            <stop offset="1" stopColor="#141922" />
          </linearGradient>
          <linearGradient id={`topBand-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a2331" />
            <stop offset="1" stopColor="#111925" />
          </linearGradient>
          <linearGradient id={`awayBar-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={awayGradient.light} />
            <stop offset="0.5" stopColor={awayGradient.base} />
            <stop offset="1" stopColor={awayGradient.dark} />
          </linearGradient>
          <linearGradient id={`homeBar-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={homeGradient.light} />
            <stop offset="0.5" stopColor={homeGradient.base} />
            <stop offset="1" stopColor={homeGradient.dark} />
          </linearGradient>
          <linearGradient id={`accent-${svgId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`baseOn-${svgId}`} cx="0.5" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#ff6b76" />
            <stop offset="0.5" stopColor="#ef2233" />
            <stop offset="1" stopColor="#c1101f" />
          </radialGradient>
          <filter id={`glowW-${svgId}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`glowR-${svgId}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            .sb-text-${svgId} { font-family: "D-DIN PRO Condensed", "D-DIN PRO", "Noto Sans JP", sans-serif; }
            .sb-name-${svgId} { font-size: 60px; font-weight: 600; fill: #eef4fd; }
            .sb-stat-${svgId} { font-size: 51px; font-weight: 600; fill: #93a3bb; }
            .sb-chip-${svgId} { font-size: 42px; font-weight: 700; fill: #ffffff; }
            .sb-abbr-${svgId} { font-weight: 700; letter-spacing: 0.5px; }
            .sb-score-${svgId} { font-size: 150px; font-weight: 700; }
            .sb-inn-${svgId} { font-size: 128px; font-weight: 700; fill: #ffffff; }
            .sb-count-${svgId} { font-size: 74px; font-weight: 700; fill: #f2f6ff; letter-spacing: 2px; }
          `}</style>
        </defs>

        <rect x="4" y="4" width="1032" height="552" rx="20" fill={`url(#bezel-${svgId})`} />
        <rect x="6" y="5" width="1028" height="6" rx="3" fill="#6d778c" opacity="0.5" />
        <rect x="13" y="13" width="1014" height="534" rx="12" fill={`url(#boardBg-${svgId})`} />
        <rect
          x="13.75"
          y="13.75"
          width="1012.5"
          height="532.5"
          rx="11"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />

        {showMatchup ? (
          <>
            <rect x="20" y="20" width="1000" height="170" rx="8" fill={`url(#topBand-${svgId})`} />
            <MatchupSvg
              svgId={svgId}
              board={board}
              batter={batter}
              pitcher={pitcher}
              attacking={attacking}
              defending={defending}
            />
          </>
        ) : null}
        {showMatchup ? (
          <rect x="20" y="198" width="1000" height="2.5" rx="1.25" fill={`url(#accent-${svgId})`} />
        ) : (
          <rect x="20" y="198" width="1000" height="2.5" rx="1.25" fill={`url(#accent-${svgId})`} opacity="0.65" />
        )}
        <InningSvg svgId={svgId} gameState={state} />
        <line x1="150" y1="214" x2="150" y2="540" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="1" />

        <TeamBarSvg
          svgId={svgId}
          side="away"
          team={away}
          score={state.score.away}
          absCount={showAbs ? state.abs.away : null}
        />
        <TeamBarSvg
          svgId={svgId}
          side="home"
          team={home}
          score={state.score.home}
          absCount={showAbs ? state.abs.home : null}
        />

        <line x1="800" y1="214" x2="800" y2="540" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="1" />
        <BasesSvg svgId={svgId} runners={state.runners} />
        <text
          className={`sb-text-${svgId} sb-count-${svgId}`}
          x="904"
          y="425"
          textAnchor="middle"
        >
          {state.balls}-{state.strikes}
        </text>
        <OutsSvg svgId={svgId} outs={state.outs} />
      </svg>
    </article>
  );
}

function MatchupSvg({ svgId, board, batter, pitcher, attacking, defending }) {
  return (
    <>
      <rect x="30" y="30" width="62" height="62" rx="11" fill={teamColor(board, attacking)} />
      <rect x="30" y="30" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14" />
      <text className={`sb-text-${svgId} sb-chip-${svgId}`} x="61" y="74" textAnchor="middle">
        {batterLabel(batter)}
      </text>
      <text className={`sb-text-${svgId} sb-name-${svgId}`} x="110" y="82">
        {batter?.playerName || "N.Batter"}
      </text>
      <text className={`sb-text-${svgId} sb-stat-${svgId}`} x="1010" y="79" textAnchor="end">
        {batterLine(batter)}
      </text>
      <line x1="30" y1="110" x2="1010" y2="110" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
      <rect x="30" y="120" width="62" height="62" rx="11" fill={teamColor(board, defending)} />
      <rect x="30" y="120" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14" />
      <text className={`sb-text-${svgId} sb-chip-${svgId}`} x="61" y="164" textAnchor="middle">
        P
      </text>
      <text className={`sb-text-${svgId} sb-name-${svgId}`} x="110" y="172">
        {pitcher?.pitcherName || "N.Pitcher"}
      </text>
      <text className={`sb-text-${svgId} sb-stat-${svgId}`} x="1010" y="169" textAnchor="end">
        P.{pitcher?.pitchCount || 0}
      </text>
    </>
  );
}

function InningSvg({ svgId, gameState }) {
  const triangle =
    gameState.inningHalf === "top" ? "88,244 116,296 60,296" : "60,452 116,452 88,504";

  return (
    <>
      <polygon points={triangle} fill="#ffffff" filter={`url(#glowW-${svgId})`} />
      <text
        className={`sb-text-${svgId} sb-inn-${svgId}`}
        x="88"
        y="421"
        textAnchor="middle"
        filter={`url(#glowW-${svgId})`}
      >
        {gameState.inningNumber}
      </text>
    </>
  );
}

function TeamBarSvg({ svgId, side, team, score, absCount }) {
  const y = side === "away" ? 212 : 382;
  const logoCy = side === "away" ? 291 : 461;
  const textY = y + 84;
  const scoreY = side === "away" ? 345 : 515;
  const dividerTop = side === "away" ? 226 : 396;
  const dividerBottom = side === "away" ? 356 : 526;
  const gradientId = side === "away" ? `awayBar-${svgId}` : `homeBar-${svgId}`;
  const clipId = `${side}TeamClip-${svgId}`;
  const label = team.abbreviation || team.name;
  const labelFontSize = Math.round(teamLabelFontSize(label) * teamAbbreviationScale(team));
  const labelWidthScale = teamAbbreviationWidth(team);

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x="162" y={y} width="638" height="158" />
        </clipPath>
      </defs>
      <rect x="162" y={y} width="638" height="158" rx="13" fill={`url(#${gradientId})`} />
      <rect x="162" y={y} width="638" height="79" rx="13" fill="#ffffff" opacity="0.10" />
      {absCount === null ? null : <AbsPipsSvg absCount={absCount} teamY={y} color={team.textColor || "#ffffff"} />}
      <TeamLogoSvg team={team} cx={263} cy={logoCy} />
      <g clipPath={`url(#${clipId})`}>
        <text
          className={`sb-text-${svgId} sb-abbr-${svgId}`}
          x="0"
          y="0"
          fontSize={labelFontSize}
          fill={team.textColor || "#ffffff"}
          dominantBaseline="central"
          transform={`translate(343 ${textY}) scale(${labelWidthScale} 1)`}
        >
          {label}
        </text>
      </g>
      <line
        x1="640"
        y1={dividerTop}
        x2="640"
        y2={dividerBottom}
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        className={`sb-text-${svgId} sb-score-${svgId}`}
        x="720"
        y={scoreY}
        textAnchor="middle"
        fill={team.textColor || "#ffffff"}
        filter={`url(#glowW-${svgId})`}
      >
        {score}
      </text>
    </>
  );
}

function AbsPipsSvg({ absCount, teamY, color }) {
  const topY = teamY + 32;
  return (
    <>
      {[0, 1].map((index) => (
        <rect
          key={index}
          x="174"
          y={topY + index * 52}
          width="13"
          height="42"
          rx="5"
          fill={color}
          opacity={index < absCount ? "0.92" : "0.35"}
        />
      ))}
    </>
  );
}

function TeamLogoSvg({ team, cx, cy }) {
  if (team.logoPath) {
    return (
      <image
        href={team.logoPath}
        x={cx - 64}
        y={cy - 64}
        width="128"
        height="128"
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  return (
    <>
      <circle cx={cx} cy={cy} r="64" fill="#f6f7f9" />
      <path
        d={`M ${cx - 39} ${cy - 43} Q ${cx - 12} ${cy} ${cx - 39} ${cy + 43}`}
        fill="none"
        stroke="#e11d2f"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + 39} ${cy - 43} Q ${cx + 12} ${cy} ${cx + 39} ${cy + 43}`}
        fill="none"
        stroke="#e11d2f"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </>
  );
}

function BasesSvg({ svgId, runners }) {
  return (
    <>
      <BaseDiamondSvg svgId={svgId} points="904,220 934,250 904,280 874,250" active={runners.second} />
      <BaseDiamondSvg svgId={svgId} points="948,264 978,294 948,324 918,294" active={runners.first} />
      <BaseDiamondSvg svgId={svgId} points="860,264 890,294 860,324 830,294" active={runners.third} />
    </>
  );
}

function BaseDiamondSvg({ svgId, points, active }) {
  if (active) {
    return (
      <polygon
        points={points}
        fill={`url(#baseOn-${svgId})`}
        stroke="#ff707b"
        strokeWidth="2"
        filter={`url(#glowR-${svgId})`}
      />
    );
  }
  return <polygon points={points} fill="#141b26" stroke="#47546c" strokeWidth="3" />;
}

function OutsSvg({ svgId, outs }) {
  return (
    <>
      {[854, 904, 954].map((cx, index) =>
        index < outs ? (
          <circle key={cx} cx={cx} cy="492" r="20" fill={`url(#baseOn-${svgId})`} filter={`url(#glowR-${svgId})`} />
        ) : (
          <circle key={cx} cx={cx} cy="492" r="20" fill="#141b26" stroke="#47546c" strokeWidth="3.5" />
        )
      )}
    </>
  );
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

function teamAbbreviationScale(team) {
  const scale = Number(team?.abbreviationScale);
  if (!Number.isFinite(scale)) return 1;
  return Math.max(0.6, Math.min(1.8, scale / 100));
}

function teamAbbreviationWidth(team) {
  const width = Number(team?.abbreviationWidth);
  if (!Number.isFinite(width)) return 1;
  return Math.max(0.3, Math.min(1.2, width / 100));
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
  const atBats =
    (batter.homeRuns || 0) +
    (batter.hits || 0) +
    (batter.strikeoutsSwinging || 0) +
    (batter.strikeoutsLooking || 0) +
    (batter.outs || 0);
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
