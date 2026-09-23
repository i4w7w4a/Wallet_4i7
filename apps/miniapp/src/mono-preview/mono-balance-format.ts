export type MonoMoneyFormat = {
  locale: string;
  currency: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export type MonoFormattedMoney = {
  parts: Intl.NumberFormatPart[];
  formatted: string;
  accessibleLabel: string;
};

const unavailable = (): MonoFormattedMoney => ({
  parts: [{ type: "literal", value: "—" }], formatted: "—", accessibleLabel: "Сумма недоступна",
});

// Keep Intl's parts and ordering intact: never split on punctuation or cast bigint to Number.
export function formatMonoMoney(value: number | bigint, format: MonoMoneyFormat): MonoFormattedMoney {
  if (typeof value === "number" && !Number.isFinite(value)) return unavailable();
  const { locale, ...options } = format;
  try {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", ...options });
    return {
      parts: formatter.formatToParts(value),
      formatted: formatter.format(value),
      accessibleLabel: new Intl.NumberFormat(locale, {
        style: "currency", ...options, currencyDisplay: "name",
      }).format(value),
    };
  } catch {
    return unavailable();
  }
}

export function formatMonoPercent(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero",
    }).format(value / 100);
  } catch {
    return "—";
  }
}
