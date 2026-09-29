import { createMonoPublishedHttp } from "../../../../src/mono-preview/mono-published-http";
import { parseMonoPublishSecurity } from "../../../../src/mono-preview/mono-published-auth";
import { MonoPublishedStore } from "../../../../src/mono-preview/mono-published-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = () => createMonoPublishedHttp(
  new MonoPublishedStore(process.env.MONO_PUBLISHED_DATA_DIR), parseMonoPublishSecurity());

export async function GET(request: Request): Promise<Response> { return handlers().session(request); }
export async function POST(request: Request): Promise<Response> { return handlers().login(request); }
export async function DELETE(request: Request): Promise<Response> { return handlers().logout(request); }
