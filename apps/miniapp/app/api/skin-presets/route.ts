import type { NextRequest } from "next/server";
import { withPresetHttp } from "../../../src/preset-library/preset-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withPresetHttp(api => api.list(request));
}

export async function POST(request: NextRequest) {
  return withPresetHttp(api => api.create(request));
}
