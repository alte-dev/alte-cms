export interface FixedWindowOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
  maxEntries?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * In-memory fixed-window rate limiter with lazy expired-entry pruning.
 * (Process-local; Redis-backed multi-process migration is planned for Faz 13.)
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(options: FixedWindowOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  private prune(currentTime: number): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [k, v] of this.entries) {
      if (currentTime > v.resetAt) {
        this.entries.delete(k);
      }
    }
  }

  consume(key: string): RateLimitDecision {
    const currentTime = this.now();
    this.prune(currentTime);

    const existing = this.entries.get(key);
    if (!existing || currentTime > existing.resetAt) {
      this.entries.set(key, { count: 1, resetAt: currentTime + this.windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        retryAfterSeconds: 0,
      };
    }

    if (existing.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      retryAfterSeconds: 0,
    };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}

export interface BruteForceGuardOptions {
  maxFailures: number;
  blockDurationMs: number;
  now?: () => number;
  maxEntries?: number;
}

export interface BruteForceDecision {
  allowed: boolean;
  remainingMinutes: number;
}

/**
 * In-memory brute-force lockout guard keyed by IP/identifier.
 */
export class BruteForceGuard {
  private readonly entries = new Map<string, { failedCount: number; blockedUntil: number }>();
  private readonly maxFailures: number;
  private readonly blockDurationMs: number;
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(options: BruteForceGuardOptions) {
    this.maxFailures = options.maxFailures;
    this.blockDurationMs = options.blockDurationMs;
    this.now = options.now ?? (() => Date.now());
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  private prune(currentTime: number): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [k, v] of this.entries) {
      if (v.blockedUntil > 0 && currentTime >= v.blockedUntil) {
        this.entries.delete(k);
      }
    }
  }

  check(key: string): BruteForceDecision {
    const currentTime = this.now();
    const entry = this.entries.get(key);
    if (entry && entry.blockedUntil > currentTime) {
      const remainingMinutes = Math.max(1, Math.ceil((entry.blockedUntil - currentTime) / 60_000));
      return { allowed: false, remainingMinutes };
    }
    if (entry && entry.blockedUntil > 0 && currentTime >= entry.blockedUntil) {
      this.entries.delete(key);
    }
    return { allowed: true, remainingMinutes: 0 };
  }

  recordFailure(key: string): void {
    const currentTime = this.now();
    this.prune(currentTime);
    const entry = this.entries.get(key) ?? { failedCount: 0, blockedUntil: 0 };
    if (entry.blockedUntil > 0 && currentTime >= entry.blockedUntil) {
      entry.failedCount = 0;
      entry.blockedUntil = 0;
    }
    entry.failedCount += 1;
    if (entry.failedCount >= this.maxFailures) {
      entry.blockedUntil = currentTime + this.blockDurationMs;
    }
    this.entries.set(key, entry);
  }

  clear(key: string): void {
    this.entries.delete(key);
  }
}
