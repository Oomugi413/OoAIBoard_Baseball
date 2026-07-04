// @ts-check
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * `collapsed` の間だけ要素をフェードアウトさせて隠し、`collapsed` が解けたら
 * フェードインで再登場させる。攻守交代の中間表示・試合終了演出で、対戦選手
 * 表示欄・イニング表示欄・通常表示（ランナー/カウント/アウト）を隠す用途に使う
 * （`docs/operation.md` 18.5・18.6）。初回マウント時はアニメーションしない。
 *
 * @param {import("react").RefObject<Element>} ref
 * @param {boolean} collapsed
 * @param {number} [duration]
 */
export function useCollapseFade(ref, collapsed, duration = 0.3) {
  const isFirstRender = useRef(true);

  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        gsap.set(ref.current, { opacity: collapsed ? 0 : 1 });
        return;
      }
      gsap.killTweensOf(ref.current);
      gsap.to(ref.current, {
        opacity: collapsed ? 0 : 1,
        duration,
        ease: collapsed ? "power1.in" : "power1.out"
      });
    },
    { scope: ref, dependencies: [collapsed] }
  );
}
