import { FadeIn } from "@/components/motion/fade-in";

// `template.tsx` (a diferencia de layout.tsx) se remonta en cada navegación dentro de
// este segmento — exactamente lo que se necesita para un fade + slide corto de página a
// página (dashboard → socios → pagos…) sin tocar cada page.tsx. Ver node_modules/next/
// dist/docs/01-app/03-api-reference/03-file-conventions/template.md.
export default function OrgTemplate({ children }: { children: React.ReactNode }) {
  return <FadeIn>{children}</FadeIn>;
}
