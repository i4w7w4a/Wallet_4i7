import type { NextRequest } from "next/server";
import { withPresetHttp } from "../../../../../src/preset-library/preset-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { slug } = await context.params;
  return withPresetHttp(api => api.history(request, slug));
}
