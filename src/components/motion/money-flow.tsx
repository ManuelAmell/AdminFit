"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

const COUNT_DURATION_S = 0.6;

/**
 * Cifra en COP que cuenta al montar (0 → valor) y hace un tween corto cuando el valor
 * cambia después (p. ej. al cambiar de periodo en el dashboard). Recibe centavos, nunca
 * decimales, y usa `formatCOP` en cada cuadro para no perder el formato "es-CO".
 *
 * No se usa el `price-flow` de Smooth UI (src/components/smoothui/price-flow): ese
 * componente es un odómetro de 2 dígitos (pensado para contadores tipo "42"), no sirve
 * para montos de varias cifras. Esto anima el número con `motion`, sin depender de eso.
 */
export function MoneyFlow({
  cents,
  className,
  durationS = COUNT_DURATION_S,
}: {
  cents: number;
  className?: string;
  durationS?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    const from = mounted.current ? value.get() : 0;
    mounted.current = true;

    if (shouldReduceMotion) {
      value.set(cents);
      if (spanRef.current) spanRef.current.textContent = formatCOP(cents);
      return;
    }

    const controls = animate(from, cents, {
      duration: durationS,
      ease: "easeOut",
      onUpdate(v) {
        value.set(v);
        if (spanRef.current) spanRef.current.textContent = formatCOP(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` es un MotionValue estable
  }, [cents, shouldReduceMotion, durationS]);

  return (
    <span ref={spanRef} className={cn("tabular-nums", className)}>
      {formatCOP(cents)}
    </span>
  );
}
