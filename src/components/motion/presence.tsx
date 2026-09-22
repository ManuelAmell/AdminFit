"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Re-exportado para no tener que acordarse de importar de "motion/react" en cada sitio
// que anula un pago, elimina una fila o muestra/oculta un estado vacío.
export { AnimatePresence };

const DURATION_S = 0.18;

// Colapsa alto + opacidad al salir, para que las filas de abajo suban con `layout` en vez
// de saltar. Úsalo dentro de <AnimatePresence> envolviendo la fila/tarjeta que se elimina.
export function Collapse({ className, children }: { className?: string; children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className={className}
      exit={{ height: 0, opacity: 0 }}
      initial={false}
      layout
      transition={{ duration: DURATION_S, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
