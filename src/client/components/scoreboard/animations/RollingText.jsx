// @ts-check
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * SVG `<text>` that rolls to a new value like a slot/split-flap display
 * (`docs/operation.md` 18.4). Pass `instant` to snap without animating —
 * used only when a plate-appearance result resets the count to 0-0.
 *
 * @param {{
 *   value: string | number,
 *   instant?: boolean,
 *   [key: string]: any
 * }} props
 */
export default function RollingText({ value, instant = false, ...rest }) {
  const ref = useRef(null);
  const timelineRef = useRef(null);
  const isFirstRender = useRef(true);
  const previousValueRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        previousValueRef.current = value;
        return;
      }
      if (value === previousValueRef.current) return;
      previousValueRef.current = value;

      // Kill the whole PREVIOUS timeline (not just gsap.killTweensOf on the element):
      // killTweensOf only removes the .to()/.from() tweens targeting ref.current, it
      // does not stop the timeline's own playhead, so a deferred .call(setDisplayValue)
      // queued later in that timeline would still fire and clobber a newer value with a
      // stale one. Under a fast run of updates (e.g. two balls and a strike fired in
      // quick succession) that left the display frozen on a stale value.
      timelineRef.current?.kill();

      if (instant) {
        gsap.set(ref.current, { attr: { dy: 0 }, opacity: 1 });
        setDisplayValue(value);
        return;
      }

      timelineRef.current = gsap.timeline()
        .set(ref.current, { attr: { dy: 0 }, opacity: 1 })
        .to(ref.current, { attr: { dy: 26 }, opacity: 0, duration: 0.14, ease: "power1.in" })
        .call(() => setDisplayValue(value))
        .set(ref.current, { attr: { dy: -26 } })
        .to(ref.current, { attr: { dy: 0 }, opacity: 1, duration: 0.2, ease: "power1.out" });
    },
    { scope: ref, dependencies: [value, instant] }
  );

  return (
    <text ref={ref} {...rest}>
      {displayValue}
    </text>
  );
}
