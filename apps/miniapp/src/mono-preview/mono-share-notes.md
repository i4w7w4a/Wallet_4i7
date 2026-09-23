# MONO appearance snapshots

`/mono/view#mono=…` opens one immutable appearance snapshot. The fragment carries
the data; the HTTP request only needs the viewer page. No preset service, owner
cookie, database, new package, or external storage is involved.

The existing `/api/skin-presets` service already has append-only revisions,
optimistic concurrency, and `?revision=N` reads. Its current envelope is a
palette envelope, not a complete working document. On the public visual preview,
the service deliberately returns 503 and PostgreSQL is absent from Compose.
Using it for complete appearance sharing would require a separate schema/API and
deployment package. An always-latest link belongs to that future package.

## Data boundary

- `MonoWorkingDocument` v2 retains three palette slots, bounded undo/redo,
  accepted shape/optics maps, and full extended appearance for each direction.
- `MonoAppearanceEnvelope` v1 contains one selected direction and its complete
  allowlisted appearance. No wallet snapshot, name, address, balance value,
  profile, editor history, secret, raw CSS/code, arbitrary asset URL, or font URL
  enters this envelope. `balance` means visual composition, never money.
- Palette seed is replaced with the fixed `mono-share` value and its action
  counter is zeroed. Both theme configurations retain the exact render values,
  including historical optional `focusAnchor` semantics.
- Explicit `typography: null` and `background: null` select the original versioned
  MONO CSS and legacy `iris/tide/strata` background respectively. They do not
  select newly introduced visual candidates.
- `MonoScene` receives trusted wallet data separately. The viewer has no editor
  storage or provider dependency. Scene extraction belongs to the common renderer
  owner, so preview and viewer use the same component.

## Save and migration

The v2 key is `wallet4i7.mono.working-presets.v2`. A missing v2 may read v1;
an existing invalid v2 fails explicitly. Loading is read-only, and saving v2
does not rewrite or delete old bytes. Generation checks continue across the
migration boundary. The separate logo preview is copied into every legacy
record/direction: v1 displayed that same global logo when switching records.
After migration these values are independent and the old logo key stays intact.

The full editor JSON export is still distinct from a share URL. Import supports
the previous v1 working envelope and palette-only exports. Applying or cancelling
a tool draft remains an editor action. Sharing must first resolve pending tool
drafts, then extract the accepted working document; the codec cannot authorize
or silently apply a pending draft.

`MonoShareButton` requires `sourceKey`, an identity that changes whenever the
accepted source changes (including preset selection, selected direction/theme,
and a saved revision). Its inner state is keyed by that identity. Old copy/open
controls disappear immediately and late async results cannot reappear under a
different source. Previously copied immutable URLs still work independently.

## Transport and limits

The transport is `m1.<SHA-256 of canonical JSON>.<gzip as base64url>`. SHA-256 detects
corruption, not authorship: appearance is public data and the checksum is not a
signature. Both encode and decode enforce the appearance schema. Unknown fields,
versions, and invalid values reject atomically. An enabled palette must pass the
existing contrast validator.

Limits: 65,536 expanded UTF-8 bytes, 16,000 token characters, 16,384 complete URL
characters. Decompression is streamed and cancelled before exceeding the expanded
limit. Nothing is truncated. Missing browser APIs produce a readable error;
clipboard failure leaves a selectable URL. The recipient needs the entire link.
As a self-contained snapshot it remains unchanged and cannot be centrally revoked.

WebKit introduced Compression Streams in [Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/).
The implementation checks the actual APIs instead of inferring support from a
browser or Telegram user agent. This does not claim that every messenger accepts
the maximum-length URL as a single message; normal and dense fixtures are measured
separately, and oversize content gets an explicit JSON-export fallback.

Measured on the isolated preview: a real light/strata/palette/custom-logo/shape
snapshot is 1,392 URL characters. A stress fixture with distinct high-precision
values in every palette override, a full typography config, and an atmosphere
recipe is 18,855 raw UTF-8 bytes / 8,907 URL characters. The latter is a transport
stress case, not a claim that it fits every messenger's message field.

The production route integration is a client host around `MonoViewer` and the
common `MonoScene`. The server supplies the existing mock wallet snapshot; that
data never comes from the URL. The route is a visual prototype, not a connected
financial account.
