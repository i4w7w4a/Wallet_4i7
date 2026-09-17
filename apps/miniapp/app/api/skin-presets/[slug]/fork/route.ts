import type { NextRequest } from "next/server";
import { withPresetHttp } from "../../../../../src/preset-library/preset-server";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { slug } = await context.params;
  return withPresetHttp(api => api.fork(request, slug));
}
