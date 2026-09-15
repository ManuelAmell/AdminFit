// Oculta el shell (sidebar, header, botones) al imprimir; solo queda [data-print-area].
const css = `
@media print {
  [data-slot="sidebar-container"], [data-slot="sidebar-gap"], [data-slot="sidebar"],
  [data-print-hide], .print-hide, [data-sonner-toaster], [data-slot="sidebar-trigger"] { display: none !important; }
  main, [data-slot="sidebar-inset"] { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; }
  body { background: #fff !important; color: #000 !important; }
  [data-print-area] { max-width: none !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; }
  @page { margin: 12mm; }
}
`;

export function PrintStyles() {
  return <style>{css}</style>;
}
