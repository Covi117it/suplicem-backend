import { test, describe } from "node:test";
import assert from "node:assert";
import { UpdateUserStatusUseCase } from "../../src/application/use-cases/user/UpdateUserStatusUseCase";

const createUser = (overrides: Record<string, any> = {}) => ({
  uid: "user-1",
  identificationType: "Cedula",
  identification: "00112345678",
  email: "user@example.com",
  names: "Ana",
  lastNames: "Perez",
  phone: "8091234567",
  userType: "client",
  createdAt: new Date().toISOString(),
  status: "pending",
  ...overrides,
});

const adminUser = createUser({
  uid: "admin-1",
  userType: "admin",
  status: "active",
});

const createUserRepo = (user: any) => ({
  getById: async (id: string) => (id === "admin-1" ? adminUser : user),
  update: async () => undefined,
} as any);

const createSmsService = () => {
  const calls: Array<{ phone: string; body: string }> = [];
  return {
    calls,
    service: {
      sendOtp: async () => undefined,
      sendMessage: async (phone: string, body: string) => {
        calls.push({ phone, body });
      },
    } as any,
  };
};

const createBotService = () => {
  const calls: any[] = [];
  return {
    calls,
    service: {
      sendAccountApprovedEmailBot: async (...args: any[]) => {
        calls.push(args);
      },
    } as any,
  };
};

describe("UpdateUserStatusUseCase - Notificaciones de estado", () => {
  test("Aprueba una cuenta pendiente y envía SMS + correo", async () => {
    const user = createUser();
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "active" }, "admin-1");

    assert.strictEqual(sms.calls.length, 1);
    assert.strictEqual(sms.calls[0].phone, "+18091234567");
    assert.match(sms.calls[0].body, /aprobada/i);
    assert.strictEqual(bot.calls.length, 1);
  });

  test("Aprueba una cuenta sin correo (registro por teléfono) y envía solo SMS", async () => {
    const user = createUser({ email: "", phone: "+18091234567" });
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "active" }, "admin-1");

    assert.strictEqual(sms.calls.length, 1);
    assert.match(sms.calls[0].body, /aprobada/i);
    assert.strictEqual(bot.calls.length, 0);
  });

  test("Desactiva una cuenta y notifica por SMS sin enviar correo", async () => {
    const user = createUser({ status: "active" });
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "inactive" }, "admin-1");

    assert.strictEqual(sms.calls.length, 1);
    assert.match(sms.calls[0].body, /desactivada/i);
    assert.strictEqual(bot.calls.length, 0);
  });

  test("Rechaza una cuenta pendiente y notifica por SMS sin enviar correo", async () => {
    const user = createUser({ status: "pending" });
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "rejected" }, "admin-1");

    assert.strictEqual(sms.calls.length, 1);
    assert.match(sms.calls[0].body, /rechazada/i);
    assert.strictEqual(bot.calls.length, 0);
  });

  test("Suspende una cuenta y notifica por SMS sin enviar correo", async () => {
    const user = createUser({ status: "active" });
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "banned" }, "admin-1");

    assert.strictEqual(sms.calls.length, 1);
    assert.match(sms.calls[0].body, /suspendida/i);
    assert.strictEqual(bot.calls.length, 0);
  });

  test("No notifica si el estado no cambia", async () => {
    const user = createUser({ status: "active" });
    const sms = createSmsService();
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(
      createUserRepo(user),
      undefined,
      sms.service,
      bot.service
    );

    await useCase.execute({ uid: user.uid, status: "active" }, "admin-1");

    assert.strictEqual(sms.calls.length, 0);
    assert.strictEqual(bot.calls.length, 0);
  });

  test("Un fallo de Twilio no impide actualizar el estado", async () => {
    const user = createUser({ status: "pending" });
    const updates: string[] = [];
    const repo = {
      getById: async (id: string) => (id === "admin-1" ? adminUser : user),
      update: async (_uid: string, updated: any) => {
        updates.push(updated.status);
      },
    } as any;
    const sms = {
      sendOtp: async () => undefined,
      sendMessage: async () => {
        throw new Error("Twilio SMS: [21608] The number is unverified");
      },
    } as any;
    const bot = createBotService();
    const useCase = new UpdateUserStatusUseCase(repo, undefined, sms, bot.service);

    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => {
      warnings.push(args.join(" "));
    };

    try {
      await useCase.execute({ uid: user.uid, status: "active" }, "admin-1");
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(user.status, "active");
    assert.deepStrictEqual(updates, ["active"]);
    assert.strictEqual(bot.calls.length, 1);
    assert.ok(warnings.some((warning) => warning.includes("[SMS] No se pudo notificar")));
    assert.ok(warnings.some((warning) => warning.includes("21608")));
  });
});
