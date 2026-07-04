// @ts-check
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { frameGeometry } from "./frameGeometry.js";

/** 表示終了後にフェードアウトする秒数。ScoreboardView側のマウント延長にも使う。 */
export const OVERLAY_FADE_OUT_SECONDS = 0.4;

/**
 * HOME RUN / 三振（K）の全面オーバーレイ演出。
 * `docs/operation.md` 18.1・18.2 の板フェード＋文字配置を実装する。
 * `showMatchup` が false のときはビューポートが縮んでいる（0 198 1200 362）ため、
 * それに合わせて板の高さと文字の中心Yを切り替える。
 *
 * @param {{
 *   svgId: string,
 *   overlay: { message: string, kind: string, reverse?: boolean, batterName?: string, pitcherStrikeouts?: number, expiresAt: number } | null,
 *   showMatchup: boolean,
 *   panelColor: string,
 *   panelTextColor: string
 * }} props
 */
export default function OverlayEffect({ svgId, overlay, showMatchup, panelColor, panelTextColor }) {
  const groupRef = useRef(null);

  useGSAP(
    () => {
      if (!overlay) return;
      gsap.killTweensOf(groupRef.current);
      const solidSeconds = Math.max(0, (overlay.expiresAt - Date.now()) / 1000);
      gsap.timeline()
        .fromTo(
          groupRef.current,
          { y: -40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }
        )
        .to(groupRef.current, { opacity: 0, duration: OVERLAY_FADE_OUT_SECONDS, ease: "power1.in" }, solidSeconds);
    },
    { scope: groupRef, dependencies: [overlay?.expiresAt] }
  );

  if (!overlay) return null;

  const isHomeRun = overlay.kind === "homeRun";

  return (
    <g ref={groupRef} pointerEvents="none">
      {isHomeRun ? (
        <HomeRunContent
          svgId={svgId}
          showMatchup={showMatchup}
          panelColor={panelColor}
          textColor={panelTextColor}
          batterName={overlay.batterName}
        />
      ) : (
        <StrikeoutContent
          svgId={svgId}
          panelColor={panelColor}
          textColor={panelTextColor}
          reverse={Boolean(overlay.reverse)}
          pitcherStrikeouts={overlay.pitcherStrikeouts || 0}
        />
      )}
    </g>
  );
}

const HOMERUN_TITLE_FONT_SIZE = 216;

function HomeRunContent({ svgId, showMatchup, panelColor, textColor, batterName }) {
  const geometry = frameGeometry(showMatchup);
  const boardTop = geometry.bezelY;
  const boardHeight = geometry.bezelHeight;
  const centerY = boardTop + boardHeight / 2;
  // 対戦選手表示ありのときは選手名を下に添えるためタイトルを少し上に、
  // 表示なしのときは選手名を出さないのでタイトルだけを上下中央に配置する。
  const titleY = showMatchup ? centerY - 10 : centerY + HOMERUN_TITLE_FONT_SIZE * 0.34;

  return (
    <>
      <rect x="4" y={boardTop} width="1192" height={boardHeight} rx="20" fill={panelColor} />
      <text
        className={`sb-text-${svgId} sb-homerun-title-${svgId}`}
        x="600"
        y={titleY}
        textAnchor="middle"
        fill={textColor}
      >
        HOME RUN
      </text>
      {showMatchup ? (
        <text
          className={`sb-text-${svgId} sb-overlay-name-${svgId}`}
          x="600"
          y={centerY + 78}
          textAnchor="middle"
          fill={textColor}
        >
          {batterName}
        </text>
      ) : null}
    </>
  );
}

// ランナー表示・カウント・アウト表記の列（区切り線 x=800 より右）だけに限定した領域。
// 選手名の表記スペースを確保する必要がなくなったため、Kをこの領域いっぱいに表示できる。
const STRIKEOUT_PANEL_X = 805;
const STRIKEOUT_PANEL_RIGHT = 1180;
const STRIKEOUT_PANEL_TOP = 200;
const STRIKEOUT_PANEL_BOTTOM = 547;
const STRIKEOUT_PANEL_WIDTH = STRIKEOUT_PANEL_RIGHT - STRIKEOUT_PANEL_X;
const STRIKEOUT_PANEL_HEIGHT = STRIKEOUT_PANEL_BOTTOM - STRIKEOUT_PANEL_TOP;
const STRIKEOUT_PANEL_CENTER_X = STRIKEOUT_PANEL_X + STRIKEOUT_PANEL_WIDTH / 2;
const STRIKEOUT_PANEL_CENTER_Y = STRIKEOUT_PANEL_TOP + STRIKEOUT_PANEL_HEIGHT / 2;

function StrikeoutContent({ svgId, panelColor, textColor, reverse, pitcherStrikeouts }) {
  const kFontSize = STRIKEOUT_PANEL_HEIGHT * 0.9;
  return (
    <>
      <rect
        x={STRIKEOUT_PANEL_X}
        y={STRIKEOUT_PANEL_TOP}
        width={STRIKEOUT_PANEL_WIDTH}
        height={STRIKEOUT_PANEL_HEIGHT}
        rx="13"
        fill={panelColor}
      />
      <text
        className={`sb-text-${svgId} sb-overlay-k-${svgId}`}
        x={STRIKEOUT_PANEL_CENTER_X}
        y={STRIKEOUT_PANEL_CENTER_Y + kFontSize * 0.34}
        fontSize={kFontSize}
        textAnchor="middle"
        fill={textColor}
        transform={reverse ? `translate(${STRIKEOUT_PANEL_CENTER_X * 2},0) scale(-1,1)` : undefined}
      >
        K
      </text>
      <text
        className={`sb-text-${svgId} sb-overlay-badge-${svgId}`}
        x={STRIKEOUT_PANEL_RIGHT - 18}
        y={STRIKEOUT_PANEL_BOTTOM - 16}
        textAnchor="end"
        fill={textColor}
      >
        ({pitcherStrikeouts})
      </text>
    </>
  );
}
