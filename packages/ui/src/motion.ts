import { useEffect, useState } from "react";
import type { Transition, Variants } from "motion/react";

/**
 * Spring transition presets for calm, responsive motion.
 * Strictly animate only transform and opacity (no layout shifts).
 */
export const spring = {
  gentle: {
    type: "spring",
    stiffness: 260,
    damping: 25,
    mass: 0.8,
  } as Transition,
  snappy: {
    type: "spring",
    stiffness: 450,
    damping: 32,
    mass: 0.6,
  } as Transition,
  bouncy: {
    type: "spring",
    stiffness: 380,
    damping: 18,
    mass: 0.7,
  } as Transition,
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring.gentle },
  exit: { opacity: 0, y: -2, scale: 0.98, transition: { duration: 0.1 } },
};

export const listRowVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
};

/** React hook honoring user OS prefers-reduced-motion */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}