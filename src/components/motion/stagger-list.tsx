"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

// Unos pocos handlers de DOM (drag/animation/transition) tienen firmas distintas en Motion
// — se omiten del tipo público en vez de pelear con el spread; nada en este archivo los usa.
type SafeProps<T extends "tr" | "tbody" | "div"> = Omit<
  ComponentPropsWithoutRef<T>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onTransitionEnd"
>;

// Solo las primeras filas entran animadas: en una tabla de 200 socios no vale la pena
// escalonar la 150, y sería lento en tablet (la recepción usa tablets de gama media).
export const STAGGER_MAX_ANIMATED = 12;
const STAGGER_STEP_S = 0.03;
const ITEM_DURATION_S = 0.2;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_STEP_S } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: ITEM_DURATION_S, ease: "easeOut" } },
};

// Fila animada de una fila ya escalonada (motion.tr — para <TableBody> plano; el padre
// debe ser <StaggerTableBody>). `index` decide si entra en el escalonado o se renderiza
// igual pero sin motion (filas más allá de STAGGER_MAX_ANIMATED, o prefers-reduced-motion).
// Mismas clases que <TableRow> (src/components/ui/table.tsx) — no se puede reusar ese
// componente directamente porque necesita ser un `motion.tr` para animar.
const TABLE_ROW_CLASS =
  "hover:bg-muted/50 has-aria-expanded:bg-muted data-[state=selected]:bg-muted border-b transition-colors";

export function StaggerTableRow({
  index,
  className,
  children,
  ...props
}: { index: number } & SafeProps<"tr">) {
  const shouldReduceMotion = useReducedMotion();
  const rowClassName = cn(TABLE_ROW_CLASS, className);
  if (shouldReduceMotion || index >= STAGGER_MAX_ANIMATED) {
    return (
      <tr data-slot="table-row" className={rowClassName} {...props}>
        {children}
      </tr>
    );
  }
  return (
    <motion.tr data-slot="table-row" className={rowClassName} variants={item} {...props}>
      {children}
    </motion.tr>
  );
}

// Reemplazo de <TableBody> (tbody) que escalona la entrada de sus <StaggerTableRow> hijas.
export function StaggerTableBody({ className, ...props }: SafeProps<"tbody">) {
  const shouldReduceMotion = useReducedMotion();
  const bodyClassName = cn("[&_tr:last-child]:border-0", className);
  if (shouldReduceMotion) {
    return <tbody data-slot="table-body" className={bodyClassName} {...props} />;
  }
  return (
    <motion.tbody
      data-slot="table-body"
      className={bodyClassName}
      initial="hidden"
      animate="show"
      variants={container}
      {...props}
    />
  );
}

// Versión div/li para grids de tarjetas o listas simples (p. ej. dashboard, cartera).
export function StaggerGroup(props: SafeProps<"div">) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <div {...props} />;
  return <motion.div initial="hidden" animate="show" variants={container} {...props} />;
}

export function StaggerItem({ index, ...props }: { index: number } & SafeProps<"div">) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion || index >= STAGGER_MAX_ANIMATED) {
    return <div {...props} />;
  }
  return <motion.div variants={item} {...props} />;
}
