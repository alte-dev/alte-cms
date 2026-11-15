import { afterEach, describe, expect, it, vi } from "vitest";
import { mapMedusaError } from "./format";

describe("SEC-033: mapMedusaError sanitizes unmapped raw Medusa messages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fixed Turkish generic message instead of leaking raw error message", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rawMsg = "SQLSTATE[42P01]: relation customer_secret_table does not match user@example.test";
    const result = mapMedusaError({ message: rawMsg, code: "INTERNAL", status: 500 });

    expect(result).toBe("İşlem gerçekleştirilemedi. Lütfen daha sonra tekrar deneyin.");
    expect(result).not.toContain("SQLSTATE");
    expect(result).not.toContain("example.test");
    expect(errSpy).toHaveBeenCalledOnce();
    // Ensure PII / raw message is not logged
    const loggedArgs = JSON.stringify(errSpy.mock.calls[0]);
    expect(loggedArgs).not.toContain("example.test");
  });
});
