-- MONO preset library. Safe to rerun; revisions are append-only.
CREATE TABLE IF NOT EXISTS skin_preset_owners (
  id UUID PRIMARY KEY,
  secret_hash TEXT NOT NULL CHECK (left(secret_hash, 7) = 'scrypt$'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS skin_presets (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]{32}$'),
  owner_id UUID NOT NULL REFERENCES skin_preset_owners(id) ON DELETE RESTRICT,
  source_preset_id UUID REFERENCES skin_presets(id) ON DELETE RESTRICT,
  current_revision INTEGER NOT NULL CHECK (current_revision >= 1),
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS skin_presets_owner_live_idx
  ON skin_presets (owner_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS skin_preset_revisions (
  preset_id UUID NOT NULL REFERENCES skin_presets(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL CHECK (char_length(description) <= 500),
  visibility TEXT NOT NULL CHECK (visibility IN ('unlisted', 'public')),
  envelope JSONB NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256-[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (preset_id, revision)
);

CREATE INDEX IF NOT EXISTS skin_preset_revisions_recent_idx
  ON skin_preset_revisions (preset_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_skin_preset_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'skin preset revisions are immutable';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'skin_preset_revisions_immutable') THEN
    CREATE TRIGGER skin_preset_revisions_immutable
      BEFORE UPDATE OR DELETE ON skin_preset_revisions
      FOR EACH ROW EXECUTE FUNCTION reject_skin_preset_revision_mutation();
  END IF;
END;
$$;
