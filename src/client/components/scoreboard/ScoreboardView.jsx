// @ts-check
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import dDinProUrl from "../../fonts/d-din-pro/D-DIN-PRO-700-Bold.woff2?url";
import dDinProExpUrl from "../../fonts/d-din-pro/D-DIN-PRO-Exp-700-Bold.woff2?url";
import notoSansJp700Url from "../../fonts/noto-sans-jp/NotoSansJP-Japanese-700.woff2?url";
import OverlayEffect, { OVERLAY_FADE_OUT_SECONDS } from "./OverlayEffect.jsx";
import RollingText from "./animations/RollingText.jsx";
import { useFadeOnChange } from "./animations/useFadeOnChange.js";
import { useCollapseFade } from "./animations/useCollapseFade.js";
import { isBoardCollapsed } from "../../../shared/scoringRules.mjs";
import { frameGeometry } from "./frameGeometry.js";
import { useScoreboardFrame } from "./useScoreboardFrame.js";

/**
 * スコアボード本体（表示専用）。
 * Broadcast LEDデザインのSVG構造をJSXで描画する。
 * @param {{ board: any }} props
 */
export default function ScoreboardView({ board }) {
  const state = board.gameState;
  const [, refreshOverlay] = useState(0);
  const [, refreshTransition] = useState(0);
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
  const loserGradient = teamGradient("#808080", "#808080");
  const attackingColor = teamColor(board, attacking);
  const attackingTextColor = teamTextColor(board, attacking);
  const defendingColor = teamColor(board, defending);
  const defendingTextColor = teamTextColor(board, defending);
  const overlayPanelColor = overlay?.kind === "homeRun" ? attackingColor : defendingColor;
  const overlayPanelTextColor = overlay?.kind === "homeRun" ? attackingTextColor : defendingTextColor;

  const activeHalfInningTransition = activeTransition(state.halfInningTransition);
  const finalResult = state.finalResult || null;
  const collapsed = isBoardCollapsed(state);
  const effectiveShowMatchup = showMatchup && !collapsed;
  const transitionLabel = finalResult ? "Final" : activeHalfInningTransition?.label || null;
  const geometry = frameGeometry(effectiveShowMatchup);

  const articleRef = useRef(null);
  const svgRef = useRef(null);
  const bezelRef = useRef(null);
  const highlightRef = useRef(null);
  const boardBgRef = useRef(null);
  const strokeRef = useRef(null);
  useScoreboardFrame(
    { articleRef, svgRef, bezelRef, highlightRef, boardBgRef, strokeRef },
    effectiveShowMatchup
  );

  const plateAppearanceSeq = state.plateAppearanceSeq || 0;
  const previousSeqRef = useRef(plateAppearanceSeq);
  const instantCountReset = plateAppearanceSeq !== previousSeqRef.current;

  useEffect(() => {
    const expiresAt = Number(state.overlay?.expiresAt || 0);
    if (!expiresAt) return undefined;
    // 表示終了後もフェードアウトの間だけマウントを維持してから消す。
    const hideAt = expiresAt + OVERLAY_FADE_OUT_SECONDS * 1000;
    const timeout = window.setTimeout(
      () => refreshOverlay((current) => current + 1),
      Math.max(0, hideAt - Date.now()) + 25
    );
    return () => window.clearTimeout(timeout);
  }, [state.overlay?.expiresAt]);

  useEffect(() => {
    const expiresAt = Number(state.halfInningTransition?.expiresAt || 0);
    if (!expiresAt) return undefined;
    const timeout = window.setTimeout(
      () => refreshTransition((current) => current + 1),
      Math.max(0, expiresAt - Date.now()) + 25
    );
    return () => window.clearTimeout(timeout);
  }, [state.halfInningTransition?.expiresAt]);

  useEffect(() => {
    previousSeqRef.current = plateAppearanceSeq;
  });

  return (
    <article ref={articleRef} className={`scoreboard${effectiveShowMatchup ? "" : " no-matchup"}`}>
      <svg
        ref={svgRef}
        className="scoreboard-svg"
        viewBox={geometry.viewBox}
        preserveAspectRatio="xMidYMax meet"
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
          <linearGradient id={`loserBar-${svgId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={loserGradient.light} />
            <stop offset="0.5" stopColor={loserGradient.base} />
            <stop offset="1" stopColor={loserGradient.dark} />
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
            @font-face {
              font-family: "D-DIN PRO Exp";
              src: url("${dDinProExpUrl}") format("woff2");
              font-style: normal;
              font-weight: 700;
              font-display: swap;
            }
            @font-face {
              font-family: "D-DIN PRO";
              src: url("${dDinProUrl}") format("woff2");
              font-style: normal;
              font-weight: 700;
              font-display: swap;
            }
            @font-face {
              font-family: "Noto Sans JP";
              src: url("${notoSansJp700Url}") format("woff2");
              font-style: normal;
              font-weight: 700;
              font-display: swap;
            }
            .sb-text-${svgId} { font-family: "D-DIN PRO Exp", "D-DIN PRO", "Noto Sans JP", sans-serif; }
            .sb-name-${svgId} { font-size: 60px; font-weight: 600; fill: #eef4fd; }
            .sb-stat-${svgId} { font-size: 51px; font-weight: 600; fill: #93a3bb; }
            .sb-chip-${svgId} { font-size: 42px; font-weight: 700; }
            .sb-abbr-${svgId} { font-family: "D-DIN PRO Exp", "D-DIN PRO", "Noto Sans JP", sans-serif; font-weight: 700; letter-spacing: 0.5px; }
            .sb-score-${svgId} { font-size: 150px; font-weight: 700; }
            .sb-inn-${svgId} { font-size: 128px; font-weight: 700; fill: #ffffff; }
            .sb-count-${svgId} { font-size: 104px; font-weight: 700; fill: #f2f6ff; letter-spacing: 2px; }
            .sb-homerun-title-${svgId} { font-size: 216px; font-weight: 700; }
            .sb-overlay-k-${svgId} { font-weight: 700; }
            .sb-overlay-badge-${svgId} { font-family: "D-DIN PRO Exp", "D-DIN PRO", "Noto Sans JP", sans-serif; font-size: 46px; font-weight: 700; }
            .sb-overlay-name-${svgId} { font-family: "Noto Sans JP", sans-serif; font-size: 54px; font-weight: 600; }
            .sb-transition-label-${svgId} { font-size: 92px; font-weight: 700; fill: #ffffff; }
          `}</style>
        </defs>

        <rect ref={bezelRef} x="4" y={geometry.bezelY} width="1192" height={geometry.bezelHeight} rx="20" fill={`url(#bezel-${svgId})`} />
        <rect ref={highlightRef} x="6" y={geometry.highlightY} width="1188" height="6" rx="3" fill="#6d778c" opacity="0.5" />
        <rect ref={boardBgRef} x="13" y={geometry.boardBgY} width="1174" height={geometry.boardBgHeight} rx="12" fill={`url(#boardBg-${svgId})`} />
        <rect
          ref={strokeRef}
          x="13.75"
          y={geometry.strokeY}
          width="1172.5"
          height={geometry.strokeHeight}
          rx="11"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />

        {showMatchup ? (
          <MatchupGroup
            svgId={svgId}
            board={board}
            batter={batter}
            pitcher={pitcher}
            attacking={attacking}
            defending={defending}
            collapsed={collapsed}
          />
        ) : null}
        {effectiveShowMatchup ? (
          <rect x="20" y="192" width="1160" height="2.5" rx="1.25" fill={`url(#accent-${svgId})`} />
        ) : null}
        <InningGroup
          svgId={svgId}
          gameState={state}
          collapsed={collapsed}
          hideNumber={Boolean(activeHalfInningTransition)}
        />
        <line x1="150" y1="214" x2="150" y2="540" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="1" />

        <TeamBarSvg
          svgId={svgId}
          side="away"
          team={away}
          score={state.score.away}
          absCount={showAbs ? state.abs.away : null}
          finalResult={finalResult}
          loserGradient={loserGradient}
        />
        <TeamBarSvg
          svgId={svgId}
          side="home"
          team={home}
          score={state.score.home}
          absCount={showAbs ? state.abs.home : null}
          finalResult={finalResult}
          loserGradient={loserGradient}
        />

        <line x1="800" y1="214" x2="800" y2="540" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="1" />
        <FieldStatusGroup svgId={svgId} state={state} collapsed={collapsed} instantCountReset={instantCountReset} />
        <TransitionLabel svgId={svgId} label={transitionLabel} collapsed={collapsed} />
        <OverlayEffect
          svgId={svgId}
          overlay={overlay}
          showMatchup={effectiveShowMatchup}
          panelColor={overlayPanelColor}
          panelTextColor={overlayPanelTextColor}
        />
      </svg>
    </article>
  );
}

function activeTransition(transition) {
  if (!transition) return null;
  return transition.expiresAt > Date.now() ? transition : null;
}

function MatchupGroup({ svgId, board, batter, pitcher, attacking, defending, collapsed }) {
  const groupRef = useRef(null);
  useCollapseFade(groupRef, collapsed);

  return (
    <g ref={groupRef}>
      <rect x="20" y="20" width="1160" height="170" rx="8" fill={`url(#topBand-${svgId})`} />
      <MatchupSvg
        svgId={svgId}
        board={board}
        batter={batter}
        pitcher={pitcher}
        attacking={attacking}
        defending={defending}
      />
    </g>
  );
}

function InningGroup({ svgId, gameState, collapsed, hideNumber }) {
  const triangleRef = useRef(null);
  const numberRef = useRef(null);
  useCollapseFade(triangleRef, collapsed);
  useCollapseFade(numberRef, hideNumber);

  const triangle =
    gameState.inningHalf === "top" ? "88,244 116,296 60,296" : "60,452 116,452 88,504";

  return (
    <>
      <g ref={triangleRef}>
        <polygon points={triangle} fill="#ffffff" filter={`url(#glowW-${svgId})`} />
      </g>
      <g ref={numberRef}>
        <text
          className={`sb-text-${svgId} sb-inn-${svgId}`}
          x="88"
          y="421"
          textAnchor="middle"
          filter={`url(#glowW-${svgId})`}
        >
          {gameState.inningNumber}
        </text>
      </g>
    </>
  );
}

function FieldStatusGroup({ svgId, state, collapsed, instantCountReset }) {
  const groupRef = useRef(null);
  useCollapseFade(groupRef, collapsed);

  return (
    <g ref={groupRef}>
      <BasesSvg svgId={svgId} runners={state.runners} />
      <RollingText
        className={`sb-text-${svgId} sb-count-${svgId}`}
        x="990"
        y="446"
        textAnchor="middle"
        value={`${state.balls}-${state.strikes}`}
        instant={instantCountReset}
      />
      <OutsSvg svgId={svgId} outs={state.outs} />
    </g>
  );
}

function TransitionLabel({ svgId, label, collapsed }) {
  const textRef = useRef(null);
  const isFirstRender = useRef(true);
  const [displayLabel, setDisplayLabel] = useState(label || "");

  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        if (label) setDisplayLabel(label);
        gsap.set(textRef.current, { opacity: collapsed ? 1 : 0 });
        return;
      }
      gsap.killTweensOf(textRef.current);
      if (collapsed) {
        if (label) setDisplayLabel(label);
        gsap.to(textRef.current, { opacity: 1, duration: 0.3, ease: "power1.out" });
      } else {
        gsap.to(textRef.current, { opacity: 0, duration: 0.3, ease: "power1.in" });
      }
    },
    { scope: textRef, dependencies: [collapsed, label] }
  );

  return (
    <text
      ref={textRef}
      className={`sb-text-${svgId} sb-transition-label-${svgId}`}
      x="990"
      y={TRANSITION_LABEL_Y}
      textAnchor="middle"
    >
      {displayLabel}
    </text>
  );
}

// 折りたたみ時（対戦選手表示の有無に関わらず）の縮小フレームの上下中央に配置する。
const TRANSITION_LABEL_FONT_SIZE = 92;
const NO_MATCHUP_FRAME_GEOMETRY = frameGeometry(false);
const TRANSITION_LABEL_Y =
  NO_MATCHUP_FRAME_GEOMETRY.boardBgY +
  NO_MATCHUP_FRAME_GEOMETRY.boardBgHeight / 2 +
  TRANSITION_LABEL_FONT_SIZE * 0.34;

function MatchupSvg({ svgId, board, batter, pitcher, attacking, defending }) {
  const batterRowRef = useRef(null);
  const pitcherRowRef = useRef(null);
  const batterKey = `${attacking}:${board.playerSettings.currentBattingOrderIndex?.[attacking] || 0}`;
  const defendingPitchers = board.playerSettings[defending]?.pitchers || [];
  const pitcherKey = `${defending}:${defendingPitchers.length}:${pitcher?.pitcherName || ""}`;

  useFadeOnChange(batterRowRef, batterKey);
  useFadeOnChange(pitcherRowRef, pitcherKey);

  return (
    <>
      <g ref={batterRowRef}>
        <rect x="30" y="30" width="62" height="62" rx="11" fill={teamColor(board, attacking)} />
        <rect x="30" y="30" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14" />
        <text className={`sb-text-${svgId} sb-chip-${svgId}`} x="61" y="74" textAnchor="middle" fill={teamTextColor(board, attacking)}>
          {batterLabel(batter)}
        </text>
        <text className={`sb-text-${svgId} sb-name-${svgId}`} x="110" y="82">
          {batter?.playerName || "N.Batter"}
        </text>
        <text className={`sb-text-${svgId} sb-stat-${svgId}`} x="1170" y="79" textAnchor="end">
          {batterLine(batter)}
        </text>
      </g>
      <line x1="30" y1="105" x2="1170" y2="105" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
      <g ref={pitcherRowRef}>
        <rect x="30" y="117" width="62" height="62" rx="11" fill={teamColor(board, defending)} />
        <rect x="30" y="117" width="62" height="30" rx="11" fill="#ffffff" opacity="0.14" />
        <text className={`sb-text-${svgId} sb-chip-${svgId}`} x="61" y="161" textAnchor="middle" fill={teamTextColor(board, defending)}>
          P
        </text>
        <text className={`sb-text-${svgId} sb-name-${svgId}`} x="110" y="169">
          {pitcher?.pitcherName || "N.Pitcher"}
        </text>
        <text className={`sb-text-${svgId} sb-stat-${svgId}`} x="1170" y="166" textAnchor="end">
          P.{pitcher?.pitchCount || 0}
        </text>
      </g>
    </>
  );
}


function TeamBarSvg({ svgId, side, team, score, absCount, finalResult, loserGradient }) {
  const y = side === "away" ? 212 : 382;
  const logoCy = side === "away" ? 291 : 461;
  const labelTop = y;
  const labelHeight = 158;
  const labelCenterY = labelTop + labelHeight / 2;
  const labelLeftX = 343;
  const labelRightX = 640;
  const scoreY = side === "away" ? 345 : 515;
  const dividerTop = side === "away" ? 226 : 396;
  const dividerBottom = side === "away" ? 356 : 526;
  const isLoser = Boolean(finalResult?.winner) && finalResult.winner !== side;
  const gradientId = isLoser ? `loserBar-${svgId}` : side === "away" ? `awayBar-${svgId}` : `homeBar-${svgId}`;
  const textColor = isLoser ? "#ffffff" : team.textColor || "#ffffff";
  const clipId = `${side}TeamClip-${svgId}`;
  const label = team.abbreviation || team.name;
  const labelFontSize = Math.round(teamLabelFontSize(label) * teamAbbreviationScale(team));
  const labelWidthScale = teamAbbreviationWidth(team);
  const textY = labelCenterY + teamLabelVerticalOffset(labelFontSize);
  const textX = team.abbreviationCentered ? (labelLeftX + labelRightX) / 2 : labelLeftX;
  const textAnchor = team.abbreviationCentered ? "middle" : "start";

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={labelLeftX} y={y} width={labelRightX - labelLeftX} height="158" />
        </clipPath>
      </defs>
      <rect x="162" y={y} width="638" height="158" rx="13" fill={`url(#${gradientId})`} />
      <rect x="162" y={y} width="638" height="79" rx="13" fill="#ffffff" opacity="0.10" />
      {absCount === null ? null : <AbsPipsSvg absCount={absCount} teamY={y} color={textColor} />}
      <TeamLogoSvg team={team} cx={263} cy={logoCy} />
      <g clipPath={`url(#${clipId})`}>
        <text
          className={`sb-text-${svgId} sb-abbr-${svgId}`}
          x="0"
          y="0"
          fontSize={labelFontSize}
          fill={textColor}
          dominantBaseline="middle"
          textAnchor={textAnchor}
          transform={`translate(${textX} ${textY}) scale(${labelWidthScale} 1)`}
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
      <RollingText
        className={`sb-text-${svgId} sb-score-${svgId}`}
        x="720"
        y={scoreY}
        textAnchor="middle"
        fill={textColor}
        filter={`url(#glowW-${svgId})`}
        value={score}
      />
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
      <BaseDiamondSvg svgId={svgId} points="990,208 1032,250 990,292 948,250" active={runners.second} />
      <BaseDiamondSvg svgId={svgId} points="1052,270 1094,312 1052,354 1010,312" active={runners.first} />
      <BaseDiamondSvg svgId={svgId} points="928,270 970,312 928,354 886,312" active={runners.third} />
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
        strokeWidth="2.8"
        filter={`url(#glowR-${svgId})`}
      />
    );
  }
  return <polygon points={points} fill="#141b26" stroke="#47546c" strokeWidth="4.2" />;
}

function OutsSvg({ svgId, outs }) {
  return (
    <>
      {[920, 990, 1060].map((cx, index) =>
        index < outs ? (
          <circle key={cx} cx={cx} cy="492" r="28" fill={`url(#baseOn-${svgId})`} filter={`url(#glowR-${svgId})`} />
        ) : (
          <circle key={cx} cx={cx} cy="492" r="28" fill="#141b26" stroke="#47546c" strokeWidth="4.9" />
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

function teamTextColor(board, side) {
  return board.teamSettings[side].textColor || "#ffffff";
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

function teamLabelVerticalOffset(fontSize) {
  return Math.round(fontSize * 0.1);
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
  return overlay.expiresAt + OVERLAY_FADE_OUT_SECONDS * 1000 > Date.now() ? overlay : null;
}
