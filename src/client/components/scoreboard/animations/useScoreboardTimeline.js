// @ts-check
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

/**
 * Shared foundation for the scoreboard's presentation animations (home run overlay,
 * strikeout overlay, batter-change fade, score/count slot digits, inning transition,
 * final display). Creates one paused gsap.timeline() scoped to `scopeRef` so effect
 * tweens can be added/rebuilt with automatic cleanup on unmount or dependency change,
 * per `docs/operation.md` 18章 and the GSAP rationale in `docs/rules.md`.
 *
 * @param {import("react").RefObject<Element>} scopeRef
 * @param {ReadonlyArray<unknown>} [dependencies]
 * @returns {import("react").RefObject<gsap.core.Timeline | null>}
 */
export function useScoreboardTimeline(scopeRef, dependencies = []) {
  const timelineRef = useRef(null);

  useGSAP(
    () => {
      timelineRef.current = gsap.timeline({ paused: true });
      return () => {
        timelineRef.current = null;
      };
    },
    { scope: scopeRef, dependencies }
  );

  return timelineRef;
}
