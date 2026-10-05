"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// `reducedMotion="user"` hace que TODO componente `motion.*` de la app respete
// `prefers-reduced-motion` del sistema operativo, sin tener que chequearlo a mano en cada
// uno (los helpers en src/components/motion/ igual lo comprueban ellos mismos para los
// casos que no pasan por `motion.*`, como el tween imperativo de MoneyFlow).
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
