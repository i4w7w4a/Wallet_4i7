import { execFileSync } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

/** Local workbench diagnostics only. This is deliberately separate from the deployed source-manifest. */
export function GET(request: Request): Response {
  const host = request.headers.get("host");
  if (process.env.NOVEX_LOCAL_PREVIEW !== "1" || !["127.0.0.1:3184", "localhost:3184"].includes(host ?? "")) {
    return new Response(null, { status: 404, headers });
  }
  try {
    const options = { cwd: process.env.NOVEX_PREVIEW_PROJECT_ROOT, encoding: "utf8" as const,
      windowsHide: true, timeout: 2000, stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"] };
    const sourceId = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
    if (!/^[a-f0-9]{40}$/.test(sourceId)) throw new Error("Missing source id");
    const changed = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=normal", "--",
      "apps/miniapp/app", "apps/miniapp/src", "packages"], options).trim().length > 0;
    return Response.json({ kind: "novex-local-preview", mode: "development", sourceId,
      sourceState: changed ? "working-tree" : "committed", launchId: process.env.NOVEX_PREVIEW_LAUNCH_ID,
      sourceAtLaunch: process.env.NOVEX_PREVIEW_SOURCE_ID, startedAt: process.env.NOVEX_PREVIEW_STARTED_AT }, { headers });
  } catch {
    return Response.json({ kind: "novex-local-preview", error: "Source metadata unavailable" }, { status: 503, headers });
  }
}
