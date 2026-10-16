/** Pinned local artwork and licensing: public/media/currency-logos/PROVENANCE.md. */
const currencyLogos: Readonly<Record<string, string>> = Object.freeze({
  btc: "/media/currency-logos/btc.svg",
  eth: "/media/currency-logos/eth.svg",
  usdc: "/media/currency-logos/usdc.svg",
});

export function CurrencyLogo({ assetId, className }: { assetId: string; className?: string }) {
  const source = Object.hasOwn(currencyLogos, assetId) ? currencyLogos[assetId] : undefined;
  if (source) return <img className={className} src={source} width="26" height="26" alt="" aria-hidden="true" draggable={false} />;
  return <svg className={className} data-currency-logo="generic" width="26" height="26" viewBox="0 0 32 32"
    fill="none" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" opacity=".6" />
    <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1" opacity=".25" />
    <circle cx="16" cy="16" r="2" fill="currentColor" opacity=".6" />
  </svg>;
}
