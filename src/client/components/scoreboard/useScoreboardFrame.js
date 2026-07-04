// @ts-check
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { geometryFromTop, NO_MATCHUP_VIEWBOX_TOP } from "./frameGeometry.js";

/**
 * 外枠（bezel/highlight/boardBg/stroke）とviewBox、外側`<article>`のaspect-ratioを
 * まとめて、GSAPで`top`（0〜NO_MATCHUP_VIEWBOX_TOP）を数値補間しながら同期させる。
 *
 * CSSのaspect-ratioトランジション＋viewBoxの瞬時切り替えという組み合わせだと、
 * 縮小時は問題ないが拡大時（対戦選手表示欄が戻る/攻守交代の中間表示が終わる）に
 * viewBoxだけ先に大きくなり、コンテナがまだ追いついていないため、一瞬「小さい
 * スコアボードが拡大する」ように見える不具合があった。viewBoxとコンテナの縦横比を
 * 同じ数値でずっと同期させることで、両方向とも同じ拡大率のまま「上から選手枠が
 * スライドして出入りする」動きにする。
 *
 * DOM属性はReactのJSX経由ではなくrefで直接書き換える。JSX側にviewBox/y/height等を
 * 渡すと、無関係な再レンダリングのたびにReactが（アニメーション中の値ではなく）
 * 最終目標値で上書きしてしまい、GSAPのトゥイーンを壊してしまうため。
 *
 * @param {{
 *   svgRef: import("react").RefObject<SVGSVGElement>,
 *   bezelRef: import("react").RefObject<SVGRectElement>,
 *   highlightRef: import("react").RefObject<SVGRectElement>,
 *   boardBgRef: import("react").RefObject<SVGRectElement>,
 *   strokeRef: import("react").RefObject<SVGRectElement>,
 *   articleRef: import("react").RefObject<HTMLElement>
 * }} refs
 * @param {boolean} effectiveShowMatchup
 * @param {number} [duration]
 */
export function useScoreboardFrame(refs, effectiveShowMatchup, duration = 0.5) {
  const topRef = useRef(effectiveShowMatchup ? 0 : NO_MATCHUP_VIEWBOX_TOP);
  const isFirstRender = useRef(true);

  useGSAP(
    () => {
      const target = effectiveShowMatchup ? 0 : NO_MATCHUP_VIEWBOX_TOP;
      if (isFirstRender.current) {
        isFirstRender.current = false;
        topRef.current = target;
        applyGeometry(refs, target);
        return;
      }
      if (topRef.current === target) return;
      const proxy = { value: topRef.current };
      gsap.to(proxy, {
        value: target,
        duration,
        ease: "power2.inOut",
        onUpdate: () => applyGeometry(refs, proxy.value)
      });
      topRef.current = target;
    },
    { scope: refs.svgRef, dependencies: [effectiveShowMatchup] }
  );
}

function applyGeometry(refs, top) {
  const g = geometryFromTop(top);
  refs.svgRef.current?.setAttribute("viewBox", g.viewBox);
  refs.bezelRef.current?.setAttribute("y", String(g.bezelY));
  refs.bezelRef.current?.setAttribute("height", String(g.bezelHeight));
  refs.highlightRef.current?.setAttribute("y", String(g.highlightY));
  refs.boardBgRef.current?.setAttribute("y", String(g.boardBgY));
  refs.boardBgRef.current?.setAttribute("height", String(g.boardBgHeight));
  refs.strokeRef.current?.setAttribute("y", String(g.strokeY));
  refs.strokeRef.current?.setAttribute("height", String(g.strokeHeight));
  if (refs.articleRef?.current) {
    refs.articleRef.current.style.aspectRatio = g.aspectRatio;
  }
}
