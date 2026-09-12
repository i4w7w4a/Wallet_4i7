import type { ReactNode, SVGProps } from "react";

import "./wallet-icon.css";

export type WalletIconName =
  | "send"
  | "receive"
  | "swap"
  | "buy"
  | "search"
  | "notifications"
  | "appearance"
  | "eye"
  | "home"
  | "portfolio"
  | "explore"
  | "settings";

type WalletIconProps = {
  name: WalletIconName;
  size?: 20 | 24 | 28;
  className?: string;
};

const PATHS: Record<WalletIconName, ReactNode> = {
  send: (
    <>
      <path d="M5 6.2 19.2 12 5 17.8l3.6-5.8Z" />
      <path d="M8.6 12h10.6" />
    </>
  ),
  receive: (
    <>
      <path d="M12 5.2v9.2" />
      <path d="m8.2 10.8 3.8 3.8 3.8-3.8" />
      <path d="M5.6 16.4v1.6A1.4 1.4 0 0 0 7 19.4h10a1.4 1.4 0 0 0 1.4-1.4v-1.6" />
    </>
  ),
  swap: (
    <>
      <path d="M7 8.2h10" />
      <path d="m14.4 5.6 3.2 2.6-3.2 2.6" />
      <path d="M17 15.8H7" />
      <path d="m9.6 13.2-3.2 2.6 3.2 2.6" />
    </>
  ),
  buy: (
    <>
      <path d="M7.2 8.6h9.6l-.8 10.2H8Z" />
      <path d="M9.2 8.6V7.4a2.8 2.8 0 0 1 5.6 0v1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="5.1" />
      <path d="m14.5 14.5 4.2 4.2" />
    </>
  ),
  notifications: (
    <>
      <path d="M7.2 9.4a4.8 4.8 0 0 1 9.6 0c0 3.8 1.3 5.2 1.3 5.2H5.9S7.2 13.2 7.2 9.4Z" />
      <path d="M10.2 18.1a1.8 1.8 0 0 0 3.6 0" />
    </>
  ),
  appearance: (
    <>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 4.8a7.2 7.2 0 0 0 0 14.4Z" fill="currentColor" opacity="0.9" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M3.8 12s3.1-6.1 8.2-6.1 8.2 6.1 8.2 6.1-3.1 6.1-8.2 6.1S3.8 12 3.8 12Z" />
      <circle cx="12" cy="12" r="2.35" />
    </>
  ),
  home: (
    <>
      <path d="m4.8 11.4 7.2-6.2 7.2 6.2" />
      <path d="M7.2 10.6v8.2h9.6v-8.2" />
    </>
  ),
  portfolio: (
    <>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 4.8v7.2h7.2" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m9.6 14.4 1.4-4.8 4.8-1.4-1.4 4.8Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.05" />
      <path d="M12 4.7v1.7M12 17.6v1.7M4.7 12h1.7M17.6 12h1.7M6.6 6.6l1.2 1.2M16.2 16.2l1.2 1.2M17.4 6.6l-1.2 1.2M7.8 16.2l-1.2 1.2" />
    </>
  ),
};

export function WalletIcon(props: WalletIconProps) {
  const { name, size = 24, className } = props;
  const svgProps: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
    className: ["wallet-icon", `wallet-icon--${size}`, className].filter(Boolean).join(" "),
  };

  return <svg {...svgProps}>{PATHS[name]}</svg>;
}
