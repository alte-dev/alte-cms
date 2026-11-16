import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { GET } from "./route";

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

describe("SEC-035: manual-refunds route fail-closed on DB errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 instead of 200 when database query throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failingPg = () => ({
      whereRaw: () => ({
        whereNull: () => ({
          select: () => ({
            orderBy: async () => {
              throw new Error("connection refused");
            },
          }),
        }),
      }),
    });

    const req: any = {
      user: { role: "admin" },
      scope: {
        hasRegistration: (key: string) => key === ContainerRegistrationKeys.PG_CONNECTION,
        resolve: () => failingPg,
      },
    };
    const res = makeMockRes();

    await GET(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body?.error).toBeTruthy();
  });
});
