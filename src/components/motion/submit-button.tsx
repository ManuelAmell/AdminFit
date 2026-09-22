"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import SmoothButton, { type SmoothButtonProps } from "@/components/smoothui/smooth-button";

const SUCCESS_FLASH_MS = 600;

/**
 * Botón primario de un formulario: carga → check breve de éxito. Pensado para acciones
 * que confirman algo importante (registrar pago, venta rápida, gasto) antes de navegar
 * fuera de la página — el check le confirma al usuario que sí quedó guardado.
 *
 * `loading` se pasa igual que a cualquier submit (`form.formState.isSubmitting`).
 * Llamar a `flashSuccess()` (del hook `useSubmitFlash`) justo antes de navegar/cerrar.
 */
export function SubmitButton({
  loading,
  success,
  children,
  ...props
}: SmoothButtonProps & { success?: boolean }) {
  return (
    <SmoothButton
      color="accent"
      loading={loading}
      prefix={success && !loading ? <Check aria-hidden="true" /> : undefined}
      variant="solid"
      {...props}
    >
      {children}
    </SmoothButton>
  );
}

// Muestra el check ~600ms antes de que el caller navegue/cierre — tiempo suficiente para
// que se perciba sin sentirse como una espera. `run` es la mutación (server action) real.
export function useSubmitFlash() {
  const [success, setSuccess] = useState(false);

  function flashSuccess() {
    setSuccess(true);
    return new Promise<void>((resolve) => setTimeout(resolve, SUCCESS_FLASH_MS));
  }

  return { success, flashSuccess };
}
