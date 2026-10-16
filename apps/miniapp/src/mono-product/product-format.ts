const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Fiat values stay in safe integer minor units through the domain and view model. */
export function formatFiatMinorParts(minor: number): Intl.NumberFormatPart[] {
  if (!Number.isSafeInteger(minor) || minor < 0) return [{ type: "literal", value: "—" }];
  const whole = BigInt(minor) / 100n;
  const cents = String(minor % 100).padStart(2, "0");
  return moneyFormatter.formatToParts(whole).map(part => part.type === "fraction"
    ? { ...part, value: cents } : part);
}

export function formatFiatMinor(minor: number): string {
  return formatFiatMinorParts(minor).map(part => part.value).join("");
}

export function formatQuantity(quantity: string): string {
  return quantity.replace(".", ",");
}
