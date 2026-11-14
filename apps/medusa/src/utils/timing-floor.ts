import crypto from "crypto";

export function resolveAccountResponseFloorMs(): number {
  const raw = process.env.ACCOUNT_RESPONSE_FLOOR_MS;
  if (!raw) return 900;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 900;
  return Math.min(parsed, 5000);
}

/**
 * Performs dummy scrypt work to equalize CPU effort when an account does not exist.
 */
export async function dummyScryptWork(password: string): Promise<void> {
  const salt = "00112233445566778899aabbccddeeff";
  await new Promise<void>((resolve) => {
    crypto.scrypt(password.slice(0, 128), salt, 64, { N: 16384, r: 8, p: 1 }, () => resolve());
  });
}

/**
 * Pads response latency up to `floorMs` from `startMs` to prevent timing side-channels.
 */
export async function waitTimingFloor(startMs: number, floorMs?: number): Promise<void> {
  const target = floorMs ?? resolveAccountResponseFloorMs();
  if (target <= 0) return;
  const elapsed = Date.now() - startMs;
  const remaining = target - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
