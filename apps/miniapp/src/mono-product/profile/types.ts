export type ProductProfileAction =
  | "edit-contacts" | "manage-verification" | "manage-2fa" | "manage-password" | "manage-addresses";

export type ProductProfileActions = Partial<Record<ProductProfileAction, () => void>>;

export type ProductProfileDetails = {
  email: string | null;
  phone: string | null;
  telegram?: string | null;
  additionalEmail?: string | null;
  languageLabel: string;
  valuationCurrencyLabel: string;
  verification: "unknown" | "not-started" | "pending" | "verified" | "rejected";
  twoFactor: "unknown" | "disabled" | "enabled";
  addressAllowlist: "unknown" | "disabled" | "enabled";
  password?: "unknown" | "set" | "not-set";
  support: { label: string; href: string } | null;
  documents: readonly { id: string; title: string; href: string }[];
};

export type ProductProfileResource =
  | { status: "loading" }
  | { status: "error"; retryable: boolean }
  | { status: "ready"; data: ProductProfileDetails };

export type ProfileContactValues = {
  displayName: string;
  email: string;
  phone: string;
  telegram: string;
  additionalEmail: string;
};

export type ProductRiskAnswers = Readonly<Record<string, string>>;
export type ProductRiskQuestion = {
  id: string;
  title: string;
  description?: string;
  options: readonly { id: string; label: string }[];
};
