export type ProductProfileAction =
  | "edit-contacts" | "manage-verification" | "manage-2fa" | "manage-password" | "manage-addresses";

export type ProductProfileActions = Partial<Record<ProductProfileAction, () => void>>;

export type ProductProfileDetails = {
  email: string | null;
  phone: string | null;
  languageLabel: string;
  valuationCurrencyLabel: string;
  verification: "unknown" | "not-started" | "pending" | "verified" | "rejected";
  twoFactor: "unknown" | "disabled" | "enabled";
  addressAllowlist: "unknown" | "disabled" | "enabled";
  support: { label: string; href: string } | null;
  documents: readonly { id: string; title: string; href: string }[];
};

export type ProductProfileResource =
  | { status: "loading" }
  | { status: "error"; retryable: boolean }
  | { status: "ready"; data: ProductProfileDetails };
