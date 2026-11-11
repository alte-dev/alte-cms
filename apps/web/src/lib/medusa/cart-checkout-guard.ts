export const COMPLETED_CART_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
export const COMPLETED_CART_MAX_ENTRIES = 5000;

interface CompletedCartEntry {
  orderId: string;
  expiresAt: number;
}

export interface CheckoutConcurrencyGuardOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

/**
 * In-process checkout concurrency & idempotency guard.
 * - Tracks in-flight cart checkout requests (`inFlightCartCheckouts`) and guarantees cleanup via `finally`.
 * - Tracks recently completed cart -> orderId mappings (`completedCartOrders`) with a 1-hour TTL and a 5000-entry FIFO/LRU cap.
 * Note: This lock is process-local (single Node.js instance). Multi-process deployments rely on Medusa's database-level cart completion lock and move distributed locks to Redis in Phase 13.
 */
export class CheckoutConcurrencyGuard {
  private readonly inFlightCartCheckouts = new Set<string>();
  private readonly completedCartOrders = new Map<string, CompletedCartEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: CheckoutConcurrencyGuardOptions = {}) {
    this.ttlMs = options.ttlMs ?? COMPLETED_CART_TTL_MS;
    this.maxEntries = options.maxEntries ?? COMPLETED_CART_MAX_ENTRIES;
    this.now = options.now ?? (() => Date.now());
  }

  private pruneExpired(currentTime: number = this.now()): void {
    for (const [cartId, entry] of this.completedCartOrders.entries()) {
      if (currentTime >= entry.expiresAt) {
        this.completedCartOrders.delete(cartId);
      } else {
        // Entries are inserted in chronological order, so we can stop at the first non-expired entry
        break;
      }
    }
  }

  public markCompleted(cartId: string, orderId: string): void {
    const currentTime = this.now();
    this.pruneExpired(currentTime);

    if (this.completedCartOrders.has(cartId)) {
      this.completedCartOrders.delete(cartId);
    }

    while (this.completedCartOrders.size >= this.maxEntries) {
      const oldestKey = this.completedCartOrders.keys().next().value;
      if (oldestKey === undefined) break;
      this.completedCartOrders.delete(oldestKey);
    }

    this.completedCartOrders.set(cartId, {
      orderId,
      expiresAt: currentTime + this.ttlMs,
    });
  }

  public getCompletedOrderId(cartId: string): string | undefined {
    const currentTime = this.now();
    const entry = this.completedCartOrders.get(cartId);
    if (!entry) return undefined;

    if (currentTime >= entry.expiresAt) {
      this.completedCartOrders.delete(cartId);
      return undefined;
    }

    return entry.orderId;
  }

  public hasCompleted(cartId: string): boolean {
    return this.getCompletedOrderId(cartId) !== undefined;
  }

  public completedSize(): number {
    this.pruneExpired();
    return this.completedCartOrders.size;
  }

  public isInFlight(cartId: string): boolean {
    return this.inFlightCartCheckouts.has(cartId);
  }

  public acquireInFlight(cartId: string): boolean {
    if (this.inFlightCartCheckouts.has(cartId)) {
      return false;
    }
    this.inFlightCartCheckouts.add(cartId);
    return true;
  }

  public releaseInFlight(cartId: string): void {
    this.inFlightCartCheckouts.delete(cartId);
  }

  public async runExclusive<T>(cartId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.acquireInFlight(cartId)) {
      throw new Error(`Cart ${cartId} checkout is already in flight`);
    }
    try {
      return await fn();
    } finally {
      this.releaseInFlight(cartId);
    }
  }
}

export const defaultCheckoutGuard = new CheckoutConcurrencyGuard();
