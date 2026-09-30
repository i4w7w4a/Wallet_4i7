import { isIP } from "node:net";

export type MonoPublishRuntimeConfig = Readonly<{
  editorOrigin: string;
  publicOrigin: string;
  remoteOrigin: string | null;
}>;

function exactOrigin(raw: string | undefined, allowLocalHttp: boolean): URL | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.origin !== raw || url.pathname !== "/" || url.search || url.hash || url.username || url.password ||
      (url.protocol !== "https:" && !(allowLocalHttp && local && url.protocol === "http:"))) return null;
  return url;
}

/** Server-only operator configuration; never infer a public link from Host or forwarded headers. */
export function parseMonoPublishRuntimeConfig(env: NodeJS.ProcessEnv = process.env): MonoPublishRuntimeConfig | null {
  const production = env.NODE_ENV === "production";
  const editor = exactOrigin(env.MONO_PUBLISH_ORIGIN, !production);
  if (!editor) return null;
  const remoteRaw = env.MONO_PUBLISHED_REMOTE_ORIGIN;
  const fixture = env.MONO_PUBLISHED_FIXTURE_MODE === "1";
  if (production) return remoteRaw || fixture ? null : {
    editorOrigin: editor.origin, publicOrigin: editor.origin, remoteOrigin: null,
  };
  if (remoteRaw) {
    if (fixture || (editor.hostname !== "localhost" && editor.hostname !== "127.0.0.1")) return null;
    const remote = exactOrigin(remoteRaw, false);
    if (!remote || remote.hostname === "localhost" || remote.hostname.endsWith(".localhost") ||
        remote.hostname.endsWith(".local") || isIP(remote.hostname) !== 0) return null;
    return { editorOrigin: editor.origin, publicOrigin: remote.origin, remoteOrigin: remote.origin };
  }
  return fixture && (editor.hostname === "localhost" || editor.hostname === "127.0.0.1")
    ? { editorOrigin: editor.origin, publicOrigin: editor.origin, remoteOrigin: null } : null;
}
