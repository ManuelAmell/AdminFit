import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isoDateInTz } from "@/lib/dates";
import { dayRange, resolveDateRange } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";

// Los servidores y contenedores suelen correr en UTC: los rangos de fecha deben calcularse
// en la TZ del gimnasio (America/Bogota, UTC-5) sin depender de la zona del proceso.
let originalTZ: string | undefined;
beforeEach(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const BOGOTA_MIDNIGHT_NOV_9 = Date.parse("2026-11-09T05:00:00.000Z");
const BOGOTA_END_NOV_9 = Date.parse("2026-11-10T04:59:59.999Z");

describe("isoDateInTz", () => {
  it("devuelve la medianoche de Bogotá de esa fecha aunque el proceso esté en UTC", () => {
    expect(isoDateInTz("2026-11-09").getTime()).toBe(BOGOTA_MIDNIGHT_NOV_9);
  });
});

describe("dayRange (cierre de caja)", () => {
  it("cubre el día completo de Bogotá, no el día anterior", () => {
    const { from, to } = dayRange("2026-11-09");
    expect(from.getTime()).toBe(BOGOTA_MIDNIGHT_NOV_9);
    expect(to.getTime()).toBe(BOGOTA_END_NOV_9);
  });
});

describe("resolveDateRange custom (filtro de pagos)", () => {
  it("no se corre un día hacia atrás en servidores UTC", () => {
    const filters = paymentFiltersSchema.parse({
      range: "custom",
      from: "2026-11-09",
      to: "2026-11-09",
    });
    const { from, to } = resolveDateRange(filters);
    expect(from?.getTime()).toBe(BOGOTA_MIDNIGHT_NOV_9);
    expect(to?.getTime()).toBe(BOGOTA_END_NOV_9);
  });
});
