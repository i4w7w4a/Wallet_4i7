import { NextResponse, type NextRequest } from "next/server";
import { createPresetHttpHandlers } from "./preset-http";
import { createPostgresPresetRepository } from "./postgres-preset-repository";

let handlers: ReturnType<typeof createPresetHttpHandlers> | null = null;

export async function withPresetHttp(
  action: (api: ReturnType<typeof createPresetHttpHandlers>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    handlers ??= createPresetHttpHandlers(createPostgresPresetRepository());
    return await action(handlers);
  } catch {
    // Never fall back to process-local storage or expose database configuration.
    return NextResponse.json({ error: "Preset service unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}

export type PresetRequest = NextRequest;
