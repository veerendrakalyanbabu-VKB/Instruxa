"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const particles = [
  [8, 18, 0, 18],
  [18, 44, 5, 23],
  [29, 12, 11, 20],
  [38, 66, 3, 26],
  [49, 28, 8, 22],
  [57, 78, 1, 25],
  [68, 16, 13, 19],
  [76, 54, 7, 24],
  [87, 24, 4, 21],
  [94, 72, 10, 27],
] as const;

export function AmbientBackground() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        element.style.setProperty("--pointer-x", `${x * 100}%`);
        element.style.setProperty("--pointer-y", `${y * 100}%`);
        element.style.setProperty("--drift-x", `${(x - 0.5) * 18}px`);
        element.style.setProperty("--drift-y", `${(y - 0.5) * 12}px`);
      });
    };

    window.addEventListener("pointermove", update, { passive: true });
    return () => {
      window.removeEventListener("pointermove", update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="motion-world" aria-hidden="true">
      <div className="motion-aurora motion-aurora-violet" />
      <div className="motion-aurora motion-aurora-cyan" />
      <div className="motion-pointer-light" />
      <div className="motion-grid" />
      <div className="motion-beam" />
      <div className="motion-orbit motion-orbit-one" />
      <div className="motion-orbit motion-orbit-two" />
      <div className="motion-particles">
        {particles.map(([x, y, delay, duration], index) => (
          <i
            key={`${x}-${y}`}
            style={
              {
                "--particle-x": `${x}%`,
                "--particle-y": `${y}%`,
                "--particle-delay": `${delay}s`,
                "--particle-duration": `${duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="motion-vignette" />
      <div className="noise" />
    </div>
  );
}
