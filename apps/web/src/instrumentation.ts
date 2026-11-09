/**
 * Next.js Server Instrumentation Hook
 * Runs once upon Node.js server initialization.
 * Pre-warms Payload CMS connection and schemas to prevent cold-start HTTP 500 races.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getPayload } = await import("payload");
      const config = await import("./payload.config");
      await getPayload({ config: config.default });
      console.log("✓ Payload CMS warm-up complete on server startup.");
    } catch (err: any) {
      console.warn("[Instrumentation] Payload warm-up warning:", err?.message || err);
    }
  }
}
