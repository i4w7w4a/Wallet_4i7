# MONO: published appearance checkpoint — 2026-10-17

Captured by nine unauthenticated public GET requests at 2026-10-16T21:05:14.739Z–2026-10-16T21:05:16.339Z (17 October in Europe/Moscow). All returned HTTP 200. Public code provenance: MONO `b212f2525fbd03a0a992a9e3d2a50ba565b50ad4`; Gold `5a1b14a8ffe79089b401c1d124b03d7343a9ee47`, BUILD_ID `Xx9rfwp9P2rZz8ufeDuQP`. Both observed source manifests and response hashes are recorded in [manifest.json](./manifest.json).

Only each record's complete `snapshot` is archived: `mono-appearance` v4, appearance and associated material data. All seven passed the repository's strict `parsePublishedRecord` / envelope / material validation. No wallet, account, profile, contacts, credentials, browser storage, editor workspace/history, or build artifacts are included.

| Slot | Public link | Revision | Full appearance snapshot |
|---|---|---:|---|
| 1 Графит | [/p/1](https://wallet.153.76.194.160.nip.io/p/1) | 2 | [slot-1.appearance.json](./slot-1.appearance.json) |
| 2 Живая среда | [/p/2](https://wallet.153.76.194.160.nip.io/p/2) | 5 | [slot-2.appearance.json](./slot-2.appearance.json) |
| 3 Светлый | [/p/3](https://wallet.153.76.194.160.nip.io/p/3) | 3 | [slot-3.appearance.json](./slot-3.appearance.json) |
| 4 Терминал | [/p/4](https://wallet.153.76.194.160.nip.io/p/4) | 3 | [slot-4.appearance.json](./slot-4.appearance.json) |
| 5 Минимал | [/p/5](https://wallet.153.76.194.160.nip.io/p/5) | 2 | [slot-5.appearance.json](./slot-5.appearance.json) |
| 6 Мягкое стекло | [/p/6](https://wallet.153.76.194.160.nip.io/p/6) | 2 | [slot-6.appearance.json](./slot-6.appearance.json) |
| 7 Фирменный | [/p/7](https://wallet.153.76.194.160.nip.io/p/7) | 2 | [slot-7.appearance.json](./slot-7.appearance.json) |

Compared with the unchanged 2 October archive, slot 2 is now revision **5** (previously 4) and its appearance changed. Slots 1 and 3–7 remain semantically equal. This checkpoint preserves the current public values; it does not replay old revisions.

Snapshot file bytes are `JSON.stringify(snapshot, null, 2) + "\n"`: UTF-8 without BOM, two-space indentation, LF endings, one final LF, and the public snapshot's parsed property order. No values are normalized or changed. The local [.gitattributes](./.gitattributes) enforces LF for committed and checked-out files. [SHA256SUMS.txt](./SHA256SUMS.txt) checks every file here except itself. The manifest separately defines sorted-key canonical snapshot hashes and raw HTTP response-body hashes; those are different byte representations.

This is an archive of appearance data, **not a server backup or publication-history backup**. No server files were copied and no server writes were made. Existing server backups and history were neither accessed nor newly verified. Recovery requires checking current server revisions and using a separately authorized explicit publication flow; these files are not overwrite instructions.
