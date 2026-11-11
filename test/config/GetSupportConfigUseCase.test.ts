import test from "node:test";
import assert from "node:assert/strict";
import { GetSupportConfigUseCase } from "../../src/application/use-cases/config/GetSupportConfigUseCase";
import { SupportConfig } from "../../src/domain/entities/SupportConfig";
import { SupportConfigRepository } from "../../src/domain/repositories/SupportConfigRepository";

test("GetSupportConfigUseCase", async (t) => {
  await t.test("retorna la configuración pública de soporte omitiendo updatedBy", async () => {
    const storedConfig: SupportConfig = {
      whatsapp: "18095550123",
      whatsappMessage: "Hola soporte",
      phone: "(809) 555-0123",
      email: "ayuda@suplicem.com",
      scheduleWeekday: "8:00 AM - 5:00 PM",
      scheduleSaturday: "9:00 AM - 12:00 PM",
      scheduleSunday: "Cerrado",
      updatedAt: "2026-11-11T12:00:00.000Z",
      updatedBy: "admin-uid-secreto",
    };

    const mockRepo: SupportConfigRepository = {
      get: async () => storedConfig,
      update: async () => {},
    };

    const useCase = new GetSupportConfigUseCase(mockRepo);
    const result = await useCase.execute();

    assert.equal(result.email, "ayuda@suplicem.com");
    assert.equal(result.whatsapp, "18095550123");
    assert.equal(result.phone, "(809) 555-0123");
    assert.equal(result.updatedAt, "2026-11-11T12:00:00.000Z");
    assert.equal("updatedBy" in result, false);
  });
});
