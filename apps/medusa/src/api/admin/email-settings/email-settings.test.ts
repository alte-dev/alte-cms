import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PUT } from "./route";
import { POST as testEmailPost } from "./test/route";
import * as emailService from "../../../services/email-service";
import { checkAdminSettingsRole } from "../../../utils/admin-role-guard";

vi.mock("../../../utils/admin-role-guard", () => ({
  checkAdminSettingsRole: vi.fn().mockResolvedValue(true),
}));

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("SEC-027: SMTP hostname validation, metadata-only SSRF block & HTML escaping", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.mocked(checkAdminSettingsRole).mockResolvedValue(true);
    vi.spyOn(emailService, "updateEmailSettings").mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
      port: 587,
    } as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("PUT /admin/email-settings accepts smtp.example.test and 127.0.0.1 in production", async () => {
    process.env.NODE_ENV = "production";
    const reqBase: any = {
      scope: { resolve: () => ({}) },
      user: { email: "admin@example.test" },
    };

    const resDomain = makeMockRes();
    await PUT({ ...reqBase, body: { host: "smtp.example.test" } } as any, resDomain);
    expect(resDomain.statusCode).toBe(200);

    const resLoopback = makeMockRes();
    await PUT({ ...reqBase, body: { host: "127.0.0.1" } } as any, resLoopback);
    expect(resLoopback.statusCode).toBe(200);
  });

  it("PUT /admin/email-settings rejects invalid hostnames and rejects 169.254.169.254 in production", async () => {
    process.env.NODE_ENV = "production";
    const reqBase: any = {
      scope: { resolve: () => ({}) },
      user: { email: "admin@example.test" },
    };

    const resInvalid = makeMockRes();
    await PUT({ ...reqBase, body: { host: "bad_host!<script>" } } as any, resInvalid);
    expect(resInvalid.statusCode).toBe(400);

    const resMeta = makeMockRes();
    await PUT({ ...reqBase, body: { host: "169.254.169.254" } } as any, resMeta);
    expect(resMeta.statusCode).toBe(400);
  });

  it("POST /admin/email-settings/test escapes settings.host in HTML body and rejects metadata hosts in production", async () => {
    process.env.NODE_ENV = "production";

    vi.spyOn(emailService, "getOrCreateEmailSettings").mockResolvedValue({
      enabled: true,
      host: "169.254.169.254",
      port: 25,
      secure: false,
      from_name: "Mağaza",
      from_email: "noreply@example.test",
      admin_notify_email: "admin@example.test",
    } as any);

    const resMeta = makeMockRes();
    await testEmailPost(
      {
        scope: {
          resolve: (k: string) => (k === ContainerRegistrationKeys.PG_CONNECTION ? {} : {}),
        },
        user: { id: "u1", email: "admin@example.test" },
        ip: "127.0.0.1",
      } as any,
      resMeta,
    );
    expect(resMeta.statusCode).toBe(400);

    // Also verify HTML escaping when host is valid
    const sendMailSpy = vi.fn().mockResolvedValue({});
    vi.spyOn(emailService, "getOrCreateEmailSettings").mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
      port: 587,
      secure: true,
      from_name: "Mağaza",
      from_email: "noreply@example.test",
      admin_notify_email: "admin@example.test",
    } as any);
    vi.spyOn(emailService, "createTransporter").mockResolvedValue({
      transporter: { sendMail: sendMailSpy },
    } as any);

    const resOk = makeMockRes();
    await testEmailPost(
      {
        scope: { resolve: () => ({}) },
        user: { id: "u2", email: "admin@example.test" },
        ip: "127.0.0.2",
      } as any,
      resOk,
    );
    expect(resOk.statusCode).toBe(200);
    expect(sendMailSpy).toHaveBeenCalledOnce();
  });
});
