"use client";

import type { WalletProfile } from "@wallet/core";

import { WalletIcon } from "../icons/wallet-icon";
import { GlassAction } from "../react-bits/glass-action/glass-action";
import "./dashboard-visuals.css";

export function ProfileHeader(props: {
  profile: WalletProfile;
  unreadCount: number;
  onSearch(): void;
  onNotifications(): void;
  onTheme(): void;
  reducedMotion: boolean;
}) {
  const { profile, unreadCount, onSearch, onNotifications, onTheme, reducedMotion } = props;
  const initials = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const notificationsLabel = unreadCount > 0 ? `Уведомления, ${unreadCount}` : "Уведомления";

  return (
    <header className="profile-header" data-reduced-motion={reducedMotion ? "true" : "false"}>
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
        <GlassAction
          className="profile-header__control"
          label="Поиск"
          icon={<WalletIcon name="search" size={24} />}
          onAction={onSearch}
        />
        <div className="profile-header__notification-control">
          <GlassAction
            className="profile-header__control"
            label={notificationsLabel}
            icon={<WalletIcon name="notifications" size={24} />}
            onAction={onNotifications}
          />
          {unreadCount > 0 ? <span className="profile-header__badge" aria-hidden="true" /> : null}
        </div>
        <GlassAction
          className="profile-header__control"
          label="Студия темы"
          icon={<WalletIcon name="appearance" size={24} />}
          onAction={onTheme}
        />
      </div>
    </header>
  );
}
