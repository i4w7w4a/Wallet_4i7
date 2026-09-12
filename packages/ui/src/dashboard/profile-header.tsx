"use client";

import type { ReactNode } from "react";
import type { WalletProfile } from "@wallet/core";

import { GlassSurface } from "../primitives/glass-surface";
import "./dashboard-visuals.css";

export function ProfileHeader(props: {
  profile: WalletProfile;
  unreadCount: number;
  onSearch(): void;
  onNotifications(): void;
  onTheme(): void;
}) {
  const { profile, unreadCount, onSearch, onNotifications, onTheme } = props;
  const initials = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const notificationsLabel = unreadCount > 0 ? `Уведомления, ${unreadCount}` : "Уведомления";

  return (
    <header className="profile-header">
      <div className="profile-header__identity">
        {profile.avatarUrl ? (
          <div
            className="profile-header__avatar"
            aria-hidden="true"
            style={{ backgroundImage: `url("${profile.avatarUrl}")` }}
          />
        ) : (
          <div className="profile-header__avatar profile-header__avatar--fallback" aria-hidden="true">
            {initials}
          </div>
        )}
        <div>
          <p className="profile-header__name">{profile.name}</p>
          <p className="profile-header__address">{profile.shortAddress}</p>
        </div>
      </div>

      <div className="profile-header__actions">
        <HeaderButton label="Поиск" onClick={onSearch}>
          <SearchIcon />
        </HeaderButton>
        <HeaderButton label={notificationsLabel} onClick={onNotifications}>
          <BellIcon />
          {unreadCount > 0 ? <span className="profile-header__badge" aria-hidden="true" /> : null}
        </HeaderButton>
        <HeaderButton label="Студия темы" onClick={onTheme}>
          <ThemeIcon />
        </HeaderButton>
      </div>
    </header>
  );
}

function HeaderButton(props: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <GlassSurface variant="clear" interactive className="profile-header__control">
      <button type="button" aria-label={props.label} onClick={props.onClick}>
        {props.children}
      </button>
    </GlassSurface>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.8 12.8 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 3.2a4.4 4.4 0 0 0-4.4 4.4v2.1l-1.3 2.4h11.4L14.4 9.7V7.6A4.4 4.4 0 0 0 10 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.2 15.2a1.8 1.8 0 0 0 3.6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 3.8v12.4A6.2 6.2 0 0 0 10 3.8Z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
