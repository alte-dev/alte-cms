export interface LockedOrderRow {
  id: string;
  status: string;
  metadata: Record<string, unknown> | null;
}

export type AtomicOrderMutationResult<T> =
  | { abort: { statusCode: number; body: Record<string, unknown> } }
  | {
      status?: string;
      metadataPatch: Record<string, unknown>;
      result: T;
    };

/**
 * SEC-003: Executes an order read-validate-write inside a PostgreSQL transaction
 * using SELECT ... FOR UPDATE and atomic JSONB merge (COALESCE(metadata, '{}'::jsonb) || patch)
 * to prevent lost updates and TOCTOU races between concurrent order operations.
 */
export async function updateOrderAtomically<T>(
  pgConnection: any,
  orderId: string,
  mutate: (row: LockedOrderRow) => AtomicOrderMutationResult<T>,
): Promise<
  { ok: false; statusCode: number; body: Record<string, unknown> } | { ok: true; result: T }
> {
  return pgConnection.transaction(async (trx: any) => {
    const lockedRes = await trx.raw(
      `SELECT id, status, metadata FROM "order" WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [orderId],
    );
    const row = lockedRes?.rows?.[0] as LockedOrderRow | undefined;

    if (!row) {
      return {
        ok: false as const,
        statusCode: 404,
        body: { error: "Sipariş bulunamadı." },
      };
    }

    const parsedMeta: Record<string, unknown> =
      typeof row.metadata === "string"
        ? JSON.parse(row.metadata)
        : row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {};

    const outcome = mutate({
      id: row.id,
      status: row.status,
      metadata: parsedMeta,
    });

    if ("abort" in outcome) {
      return {
        ok: false as const,
        statusCode: outcome.abort.statusCode,
        body: outcome.abort.body,
      };
    }

    const patchJson = JSON.stringify(outcome.metadataPatch);
    if (outcome.status) {
      await trx.raw(
        `UPDATE "order"
         SET status = ?,
             metadata = COALESCE(metadata, '{}'::jsonb) || CAST(? AS jsonb),
             updated_at = NOW()
         WHERE id = ?`,
        [outcome.status, patchJson, orderId],
      );
    } else {
      await trx.raw(
        `UPDATE "order"
         SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(? AS jsonb),
             updated_at = NOW()
         WHERE id = ?`,
        [patchJson, orderId],
      );
    }

    return { ok: true as const, result: outcome.result };
  });
}

/**
 * SEC-007: Resolves the authenticated Medusa v2 admin actor identifier from req.auth_context.actor_id.
 */
export function resolveAdminActorId(req: any): string {
  const actorId = req?.auth_context?.actor_id;
  if (typeof actorId === "string" && actorId.trim().length > 0) {
    return actorId.trim();
  }
  const userEmail = req?.user?.email;
  if (typeof userEmail === "string" && userEmail.trim().length > 0) {
    return userEmail.trim();
  }
  const userId = req?.user?.id;
  if (typeof userId === "string" && userId.trim().length > 0) {
    return userId.trim();
  }
  return "admin";
}
