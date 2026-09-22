"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const DURATION_S = 0.2;

// Fade + slide corto (8px) para transiciones de página y estados vacíos ("Aún no hay
// gastos este mes", "Sin socios por vencer"…). Va dentro de <AnimatePresence> cuando el
// contenido puede desmontarse (usa el `AnimatePresence` de "motion/react" directamente).
export function FadeIn({ className, children }: { className?: string; children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      exit={{ opacity: 0, y: -4 }}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION_S, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
