import { CSV_TEMPLATE } from "@/modules/members/import";

export function GET() {
  return new Response("﻿" + CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-socios.csv"',
    },
  });
}
