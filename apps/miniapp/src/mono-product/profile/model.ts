import type { ProductProfileResource } from "./types";

export function createDemoProfileResource(): ProductProfileResource {
  return { status: "ready", data: {
    email: null,
    phone: null,
    languageLabel: "Русский",
    valuationCurrencyLabel: "USD",
    verification: "unknown",
    twoFactor: "unknown",
    addressAllowlist: "unknown",
    support: null,
    documents: [],
  } };
}

/** Scheme safety only; the host remains responsible for authorizing link destinations. */
export function isProfileLinkAllowed(href: string): boolean {
  if (typeof href !== "string" || /[\\\u0000-\u0020\u007f]/.test(href)) return false;
  const authority = /^https:\/\/([^/?#]+)/i.exec(href)?.[1];
  // Require an explicit authority; reject even empty userinfo ("https://@host").
  if (!authority || authority.includes("@")) return false;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && url.hostname.length > 0 && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
