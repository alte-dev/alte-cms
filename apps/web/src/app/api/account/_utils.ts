import { NextResponse } from "next/server";
import { MedusaApiError } from "../../../lib/medusa/client";

export function handleAccountApiError(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof MedusaApiError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 400;
    return NextResponse.json({ error: err.message || fallbackMessage }, { status });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
