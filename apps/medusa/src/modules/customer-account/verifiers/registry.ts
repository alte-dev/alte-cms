import type { LegacyPasswordVerifier } from "./types";

const TEST_ALGORITHMS = new Set(["fake-test", "test"]);

function isTestAlgorithm(alg: string): boolean {
  return TEST_ALGORITHMS.has(alg) || alg.startsWith("test-");
}

/**
 * Registry of legacy password verifiers (used in Faz 10 for WooCommerce migration).
 * In Faz 12, the default runtime registry has zero registered verifiers.
 * Test algorithms are strictly forbidden when NODE_ENV === "production".
 */
export class LegacyVerifierRegistry {
  private readonly verifiers = new Map<string, LegacyPasswordVerifier>();
  private readonly isProduction: boolean;

  constructor(options?: { isProduction?: boolean }) {
    this.isProduction = options?.isProduction ?? process.env.NODE_ENV === "production";
  }

  register(verifier: LegacyPasswordVerifier): void {
    const alg = verifier.algorithm.trim().toLowerCase();
    if (!alg) {
      throw new Error("Legacy verifier algorithm cannot be empty.");
    }
    if (this.isProduction && isTestAlgorithm(alg)) {
      throw new Error(
        `[Security] Test legacy verifier algorithm '${alg}' cannot be registered in production.`,
      );
    }
    this.verifiers.set(alg, verifier);
  }

  has(algorithm: string): boolean {
    return this.verifiers.has(algorithm.trim().toLowerCase());
  }

  async verify(algorithm: string, password: string, legacyHash: string): Promise<boolean> {
    const verifier = this.verifiers.get(algorithm.trim().toLowerCase());
    if (!verifier) {
      return false; // Fail-closed
    }
    try {
      return await verifier.verify(password, legacyHash);
    } catch {
      return false;
    }
  }
}

export const defaultLegacyVerifierRegistry = new LegacyVerifierRegistry();
