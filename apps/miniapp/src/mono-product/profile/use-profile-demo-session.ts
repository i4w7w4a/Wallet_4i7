"use client";

import { useCallback, useMemo, useState } from "react";
import type { WalletProfile } from "@wallet/core";
import { createDemoProfileResource } from "./model";
import type { ProfileContactValues, ProductProfileResource, ProductRiskAnswers } from "./types";

export type ProfileDemoSessionOptions = {
  profile: WalletProfile;
  resource?: ProductProfileResource;
  /** The host's stable user key, when available. Never use an edited display name. */
  identityKey?: string;
  avatarSrc?: string | null;
};

export type ProfileDemoSession = {
  profile: WalletProfile;
  resource: ProductProfileResource;
  contacts: ProfileContactValues;
  avatarSrc: string | null;
  /** In-memory source identity/revision; also invalidates open drafts on replacement. */
  sourceKey: string;
  saveContacts(values: ProfileContactValues): void;
  riskAnswers: ProductRiskAnswers;
  saveRiskAnswers(answers: ProductRiskAnswers): void;
};

type SessionState = { sourceKey: string; generation: number; contacts: ProfileContactValues | null; riskAnswers: ProductRiskAnswers };
const emptySession = (sourceKey: string, generation = 0): SessionState => ({ sourceKey, generation, contacts: null, riskAnswers: {} });

/** Mount above conditional Profile navigation. This hook never persists or verifies data. */
export function useProfileDemoSession({ profile, resource, identityKey, avatarSrc }: ProfileDemoSessionOptions): ProfileDemoSession {
  const fallback = useMemo(createDemoProfileResource, []);
  const source = resource ?? fallback;
  const details = source.status === "ready" ? source.data : null;
  const sourceContacts = useMemo<ProfileContactValues>(() => ({
    displayName: profile.name,
    email: details?.email ?? "",
    phone: details?.phone ?? "",
    telegram: details?.telegram ?? "",
    additionalEmail: details?.additionalEmail ?? "",
  }), [profile.name, details]);
  // Compare source values, rather than object identity: harmless host rerenders must keep this session.
  const sourceKey = JSON.stringify([identityKey ?? profile.shortAddress, profile.shortAddress,
    profile.name, profile.avatarUrl, source.status, sourceContacts]);
  const [stored, setStored] = useState<SessionState>(() => emptySession(sourceKey));
  let state = stored;
  if (state.sourceKey !== sourceKey) {
    state = emptySession(sourceKey, state.generation + 1);
    setStored(state);
  }
  // Returning to the same source values starts a new lifetime, never revives its retired callbacks.
  const generation = state.generation;
  const contacts = state.contacts ?? sourceContacts;
  const resolvedAvatar = (avatarSrc === undefined ? profile.avatarUrl : avatarSrc)?.trim() || null;
  const resolvedProfile = useMemo(() => state.contacts || resolvedAvatar !== profile.avatarUrl
    ? { ...profile, name: contacts.displayName, avatarUrl: resolvedAvatar } : profile,
  [profile, contacts.displayName, state.contacts, resolvedAvatar]);
  const resolvedResource = useMemo<ProductProfileResource>(() => source.status === "ready" && state.contacts
    ? { ...source, data: { ...source.data, email: contacts.email || null, phone: contacts.phone || null,
      telegram: contacts.telegram || null, additionalEmail: contacts.additionalEmail || null } } : source,
  [source, state.contacts, contacts]);
  const saveContacts = useCallback((values: ProfileContactValues) => {
    if (source.status !== "ready") return;
    setStored(current => current.sourceKey === sourceKey && current.generation === generation
      ? { ...current, contacts: { ...values } } : current);
  }, [source.status, sourceKey, generation]);
  const saveRiskAnswers = useCallback((answers: ProductRiskAnswers) => {
    setStored(current => current.sourceKey === sourceKey && current.generation === generation
      ? { ...current, riskAnswers: { ...answers } } : current);
  }, [sourceKey, generation]);
  return { profile: resolvedProfile, resource: resolvedResource, contacts, avatarSrc: resolvedAvatar,
    sourceKey: JSON.stringify([sourceKey, generation]), saveContacts, riskAnswers: state.riskAnswers, saveRiskAnswers };
}
