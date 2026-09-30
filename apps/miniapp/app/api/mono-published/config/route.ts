import { createMonoPublishedHttp } from "../../../../src/mono-preview/mono-published-http";
import { parseMonoPublishRuntimeConfig } from "../../../../src/mono-preview/mono-published-config";
import { MonoPublishedStore } from "../../../../src/mono-preview/mono-published-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return createMonoPublishedHttp(new MonoPublishedStore(process.env.MONO_PUBLISHED_DATA_DIR),
    parseMonoPublishRuntimeConfig()).config();
}
