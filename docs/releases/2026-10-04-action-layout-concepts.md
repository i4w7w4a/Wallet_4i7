# Standalone A/B/C action layout concepts — 2026-10-04

Published 2026-10-04 at 22:13 MSK (19:13 UTC), with direct owner authorization to keep all three examples available for client discussion. This release publishes only the standalone compositions.

## Verified public links

- [Comparison page](https://wallet.153.76.194.160.nip.io/concepts/)
- [A — priority / two primary + two secondary](https://wallet.153.76.194.160.nip.io/concepts/?variant=priority)
- [B — strip / four actions in one row](https://wallet.153.76.194.160.nip.io/concepts/?variant=strip)
- [C — more / primary pair + additional menu](https://wallet.153.76.194.160.nip.io/concepts/?variant=more)

One HTTPS verification pass returned 200 for the comparison page, all three variants, CSS, JS, logo, font and font license. Response content hashes matched the six preserved source files. Relative links and asset URLs resolve under `/concepts/`; no path or design change was needed. ORCHESTR WALL completed the public browser pass: comparison page → A → Receive compact menu → comparison page, with a screenshot saved/shown. All three compositions and mini menus had already passed local review. No private data or real operations were used.

## Preserved source and hashes

Tracked archive: `prototypes/action-layouts/`. Exactly six original files, plus README, source manifest and byte-preservation attributes. The attributes prevent Git line-ending conversion; the original font license whitespace is retained verbatim. Only the six original files were uploaded to the public static root. No private screenshots, repository root, `.superpowers` or archive metadata were published there.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `index.html` | 8962 | `08f7347c9d9cce6b842d2efee947fb322fea277b80b306b73d894dd037268aad` |
| `styles.css` | 16947 | `8345472d380d42f083eedbf3d386a790b331249431cb409563c994d971467fdb` |
| `app.js` | 15573 | `b8d9e0f38641d328287670d34048390e281fec00450d186a0bc15e8f88947eba` |
| `assets/novex-logo.svg` | 7571 | `d5637d3d575881e42dd7bfb5ba83c6d9d77989c7d838be274f30eb513ebfd2ab` |
| `assets/manrope-variable.woff2` | 53736 | `ec48a797c0f2b33917ce9b7751021719ea1fbd46fb5c584c59c1ea1064678de7` |
| `assets/OFL-Manrope.txt` | 4480 | `4b8929f05a122b7abb9059501dc7dc4df86f8c97d5a1769d60d82cf2d2795dde` |

Manifest SHA-256: `181724ace7e355e78f1c3f2db9bd1024e1e7b4d39b2f1c5134c2751cb6063f48`.
Uploaded six-file archive SHA-256: `dfa372b78a31f103a62fb83fbe2b4a617616116ce284ed5d734fade12c85e0db`.
Static release ID: `20261004T190816Z`.

The examples have demo data, local menus and page-memory preferences. They have no backend/API/browser persistence or real financial actions. The composition does not reproduce all GPU materials of MONO. No choice among A/B/C has been applied to the working product.

## Route and atomic static release

The path was free (HTTP 404) before publication. Existing gateway `shared-gateway-gateway-1` already mounts a persistent `/data` volume. A separate static namespace was created inside it:

- Container release: `/data/novex-concepts/releases/20261004T190816Z`.
- Active root: `/data/novex-concepts/current`, atomically replaced relative symlink to that release.
- Host release: `/var/lib/docker/volumes/shared-gateway_caddy-data/_data/novex-concepts/releases/20261004T190816Z`.

Only the wallet host block changed:

```caddyfile
wallet.153.76.194.160.nip.io {
    encode zstd gzip
    redir /concepts /concepts/?{query} 308
    handle_path /concepts/* {
        root * /data/novex-concepts/current
        file_server
    }
    handle {
        reverse_proxy novex-mono:3000
    }
}
```

All bytes outside that host block were preserved. Adapted Caddy JSON outside the wallet route matched before/after, with generated group identifiers normalized while preserving their relationships. Candidate `caddy validate` passed; `caddy reload` applied it to the existing process. The Caddyfile bind mount keeps its inode: the host file was written in place after validation and fsync, then the mounted content hash was checked before reload. No gateway/app container was restarted or added; all running container identities stayed the same. No Next build was run.

Caddyfile SHA-256 before: `38d6e34dec9f31c2c2654f4740777a1763db3f211786d75a1715b2d55c8440e7`.
Caddyfile SHA-256 after: `8eb2c2dbb386533ab0d3fd23dd4702affaf111d80a2e69eaf8e1e5a758e3b241`.
Existing gateway image: `caddy:2.10-alpine`, ID `sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d`.

The route uses documented [handle_path](https://caddyserver.com/docs/caddyfile/directives/handle_path), [file_server](https://caddyserver.com/docs/caddyfile/directives/file_server) and [validate/reload](https://caddyserver.com/docs/command-line) behavior.

## Main product and presets preserved

The actual main source manifest before/after matched exactly: Git SHA `85d33d2a2b105efeaab419f194424fa7ce553d5a`, image `novex-wallet:20261003T190633Z-85d33d2`, image ID `sha256:6c69ce397a829aedfdbbd2dfd5f4340c57d08d33e43443dfff0b77526664ff32`. Main container identity stayed the same. This release did not bring the server to any other Git SHA.

All 27 files of the current publication volume, including the seven slot records and history, matched the fresh pre-activation baseline. No composition, preset record, history, profile or browser storage was written. Motion source `3435a4894f1ad8a6cc4598ab4469b3a6475ec544` was not deployed. Local 3184 and 3185 remain running. DLC, Stitch, V1, DB, other domains and credentials were not changed.

## Backup, rollback and evidence

Protected remote ops: `/opt/novex/releases/action-layouts/20261004T190816Z/`.
Protected local ops: `C:/Users/iwwa/.novex-ops/concepts/releases/20261004T190816Z/`.
Exact configuration backup: `Caddyfile.before`, matching the before hash above. It was captured before activation and retained on the server and in the verified local copy. Evidence: `baseline.json`, `adapted.before.json`, `adapted.candidate.json`, `deployment-evidence.json`, source packet/archive.

For this first static release the previous pointer was absent. Rollback removes only this route/release pointer: while the active Caddyfile still has the deployed after hash, restore `Caddyfile.before` **in place**, verify the mounted file hash, and run `caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` in the same gateway. Remove the current symlink only if it still points to `releases/20261004T190816Z`. The isolated release files can remain for recovery; `/concepts/` then returns to its previous absent route. If configuration has changed concurrently, stop and prepare an inverse wallet-only change instead of overwriting other domains. Main image and published data are outside this rollback.

The local Git commit is restricted to this document and `prototypes/action-layouts/`. No branch push or merge is part of this publication.
