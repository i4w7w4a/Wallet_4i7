import type { ProductAccountKind } from "@wallet/core";

export function AccountKindIcon({ kind, className }: { kind: ProductAccountKind; className: string }) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    {kind === "custodial" ? <><path d="M6 11h20M8 11v13m8-13v13m8-13v13M5 25h22M6 8l10-4 10 4" /></>
      : kind === "depositary" ? <><path d="M6 10 16 5l10 5v13l-10 5-10-5ZM6 10l10 5 10-5M16 15v13" /></>
        : <><circle cx="16" cy="16" r="10" /><path d="M12 12h8v8h-8Z" /></>}
  </svg>;
}
