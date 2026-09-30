import { createMonoPublishedHttp } from "../../../../src/mono-preview/mono-published-http";
import { parseMonoPublishRuntimeConfig } from "../../../../src/mono-preview/mono-published-config";
import { MonoPublishedStore } from "../../../../src/mono-preview/mono-published-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slot: string }> };
const handlers = () => createMonoPublishedHttp(
  new MonoPublishedStore(process.env.MONO_PUBLISHED_DATA_DIR), parseMonoPublishRuntimeConfig());

export async function GET(_request: Request, context: Context): Promise<Response> {
  return handlers().get((await context.params).slot);
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  return handlers().put(request, (await context.params).slot);
}
