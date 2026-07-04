// @ts-check

// 対戦選手表示なし（および攻守交代/試合終了の折りたたみ）のときのviewBox上端。
// 198だと外枠内側の背景（top+13）が先攻チーム枠（y=212）とほぼ隙間なく接してしまうため、
// 外枠の太さ（bezelとboardBgのマージン差、9px）以上の隙間ができるよう180まで広げる。
export const NO_MATCHUP_VIEWBOX_TOP = 180;

/**
 * viewBoxの上端の任意の連続値からジオメトリを計算する。GSAPでtopをアニメーション
 * させながら毎フレーム呼び出すことを想定（`useScoreboardFrame`参照）。
 * @param {number} top
 */
export function geometryFromTop(top) {
  return {
    top,
    viewBox: `0 ${top} 1200 ${560 - top}`,
    bezelY: top + 4,
    bezelHeight: 552 - top,
    highlightY: top + 5,
    boardBgY: top + 13,
    boardBgHeight: 534 - top,
    strokeY: top + 13.75,
    strokeHeight: 532.5 - top,
    aspectRatio: `1200 / ${560 - top}`
  };
}

/**
 * @param {boolean} effectiveShowMatchup
 */
export function frameGeometry(effectiveShowMatchup) {
  return geometryFromTop(effectiveShowMatchup ? 0 : NO_MATCHUP_VIEWBOX_TOP);
}
