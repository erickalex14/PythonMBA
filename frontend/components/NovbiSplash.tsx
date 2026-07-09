import React, { useEffect, useRef, useState } from "react";

/**
 * NOVBI — animated loading splash.
 * Self-contained React component (TSX), no external dependencies.
 *
 * Usage:
 *   <NovbiSplash />                 // fills its parent, loops forever
 *   <NovbiSplash loop={false} />    // plays once and stays on the final frame
 *
 * Timeline (seconds), one full cycle = LOOP_DURATION:
 *   0.00 - 0.70  lockup slides in from the left + fades in
 *   0.70 - 1.15  "BI" box bounces (jump + squash landing)
 *   1.15 - 1.80  box expands, "BI" crossfades to "Business Intelligence"
 *   1.80 - 2.95  hold
 *   2.95 - 3.25  fade out, then restart
 */

const LOOP_DURATION = 3.25;

const FONT = "'Helvetica Neue', Arial, sans-serif";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
function tRange(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return clamp01((t - a) / (b - a));
}
const Easing = {
  easeOutCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  easeOutQuad: (x: number) => 1 - (1 - x) * (1 - x),
  easeInQuad: (x: number) => x * x,
};

export interface NovbiSplashProps {
  /** Loop forever (default) or play once and hold on the final frame. */
  loop?: boolean;
  /** Called once, at the end of the very first cycle (useful to hide the splash). */
  onFirstCycleEnd?: () => void;
  /** Background color behind the lockup. Default white. */
  background?: string;
}

export default function NovbiSplash({
  loop = true,
  onFirstCycleEnd,
  background = "#ffffff",
}: NovbiSplashProps) {
  const [t, setT] = useState(0);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;

      if (!loop && elapsed >= LOOP_DURATION) {
        setT(LOOP_DURATION);
        if (!firedRef.current) {
          firedRef.current = true;
          onFirstCycleEnd?.();
        }
        return;
      }

      const cur = elapsed % LOOP_DURATION;
      setT(cur);

      if (!firedRef.current && elapsed >= LOOP_DURATION) {
        firedRef.current = true;
        onFirstCycleEnd?.();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  // ---- timeline math (mirrors the original animation) ----
  const slideP = Easing.easeOutCubic(tRange(t, 0.0, 0.7));
  const fadeInP = tRange(t, 0.0, 0.28);
  const groupX = -560 * (1 - slideP);
  const groupOpacity = fadeInP;

  const upP = Easing.easeOutQuad(tRange(t, 0.7, 0.85));
  const downP = Easing.easeInQuad(tRange(t, 0.85, 1.0));
  const boxY = t < 0.85 ? -34 * upP : -34 * (1 - downP);
  const squashP = tRange(t, 1.0, 1.18);
  const squash = Math.sin(squashP * Math.PI);
  const boxScaleY = 1 - 0.16 * squash;
  const boxScaleX = 1 + 0.09 * squash;

  const BOX_W0 = 190;
  const BOX_W1 = 1300;
  const expandP = Easing.easeOutCubic(tRange(t, 1.15, 1.8));
  const boxWidth = BOX_W0 + (BOX_W1 - BOX_W0) * expandP;
  const biOutOpacity = 1 - tRange(t, 1.15, 1.32);
  const longInOpacity = tRange(t, 1.4, 1.85);

  const fadeOutP = loop ? tRange(t, 2.95, 3.25) : 0;
  const finalOpacity = groupOpacity * (1 - fadeOutP);

  const NOV_W = 322;
  const GAP_LEFT = 20;
  const GAP_RIGHT = 46;
  const SEP_W = 6;
  const BOX_LEFT = NOV_W + GAP_LEFT + SEP_W + GAP_RIGHT;
  // stage is a 1920x1080 design space, scaled by the wrapper below
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const GROUP_LEFT = STAGE_W / 2 - (BOX_LEFT + boxWidth) / 2;
  const BOX_TOP = STAGE_H / 2 - 95;
  const BOX_H = 190;

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          // scale the fixed 1920x1080 design to fill the container
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            flex: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: GROUP_LEFT,
              top: 0,
              width: BOX_LEFT + BOX_W1 + 40,
              height: STAGE_H,
              opacity: finalOpacity,
              transform: `translateX(${groupX}px)`,
            }}
          >
            {/* NOV */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: BOX_TOP,
                width: NOV_W,
                height: BOX_H,
                display: "flex",
                alignItems: "center",
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 140,
                letterSpacing: "-0.01em",
                color: "#0a0a0a",
                lineHeight: 1,
              }}
            >
              NOV
            </div>

            {/* separator */}
            <div
              style={{
                position: "absolute",
                left: NOV_W + GAP_LEFT,
                top: BOX_TOP + 18,
                width: SEP_W,
                height: BOX_H - 36,
                background: "#0a0a0a",
              }}
            />

            {/* BI box */}
            <div
              style={{
                position: "absolute",
                left: BOX_LEFT,
                top: BOX_TOP,
                width: boxWidth,
                height: BOX_H,
                background: "#0a0a0a",
                transform: `translateY(${boxY}px) scale(${boxScaleX}, ${boxScaleY})`,
                transformOrigin: "left bottom",
                overflow: "hidden",
              }}
            >
              {/* BI short label */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT,
                  fontWeight: 300,
                  fontSize: 134,
                  letterSpacing: "-0.015em",
                  color: "#ffffff",
                  opacity: biOutOpacity,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                BI
              </div>

              {/* Business Intelligence long label */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 36,
                  fontFamily: FONT,
                  fontWeight: 300,
                  fontSize: 134,
                  letterSpacing: "-0.015em",
                  color: "#ffffff",
                  opacity: longInOpacity,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                Business Intelligence
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
