// @ts-check
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * Fades `ref`'s element out then back in whenever `changeKey` differs from its
 * previous value. Skips the very first render so nothing animates on mount.
 * Used for the batter/pitcher-change fade in `docs/operation.md` 18.3.
 *
 * @param {import("react").RefObject<Element>} ref
 * @param {string | number} changeKey
 */
export function useFadeOnChange(ref, changeKey) {
  const isFirstRender = useRef(true);

  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      gsap.killTweensOf(ref.current);
      gsap.timeline()
        .set(ref.current, { opacity: 1 })
        .to(ref.current, { opacity: 0, duration: 0.18, ease: "power1.in" })
        .to(ref.current, { opacity: 1, duration: 0.22, ease: "power1.out" });
    },
    { scope: ref, dependencies: [changeKey] }
  );
}
