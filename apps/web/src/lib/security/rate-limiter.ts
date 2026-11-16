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
 * Process-local fixed-window rate limiter with lazy expired-entry pruning.
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

  private prune(currentTime: number, incomingKey: string): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [k, v] of this.entries) {
      if (currentTime > v.resetAt) {
        this.entries.delete(k);
      }
    }
    if (!this.entries.has(incomingKey)) {
      while (this.entries.size >= this.maxEntries) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey === undefined) break;
        this.entries.delete(oldestKey);
      }
    }
  }

  consume(key: string): RateLimitDecision {
    const currentTime = this.now();
    this.prune(currentTime, key);

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
}
