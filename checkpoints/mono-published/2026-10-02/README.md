# MONO: published appearance checkpoint — 2026-10-02

Captured from the public read-only API at 2026-10-01T21:17:29.898Z. The live `source-manifest.json.gitHead` was `800a637e0559bfe585df4e2732f4bb14435b0a1f` (image `novex-wallet:20261001T085423Z-800a637`). This checkpoint commit is an archival child of that code commit; creating it does not deploy new code or change the default branch.

Only the `snapshot` field of each public record is saved. Every file is a complete `mono-appearance` v4 envelope with appearance and material settings. Revision and integrity metadata are in [`manifest.json`](./manifest.json); [`SHA256SUMS.txt`](./SHA256SUMS.txt) checks the committed file bytes. No browser `localStorage`, editor workspace/history, wallet/profile data, credentials, or server access files are included.

| Published slot | Public link | Revision | Full appearance snapshot | File SHA-256 |
|---|---|---:|---|---|
| 1 Графит | [`/p/1`](https://wallet.153.76.194.160.nip.io/p/1) | 2 | [`slot-1.appearance.json`](./slot-1.appearance.json) | `1176901cc0c654a50582dde454a5ee1d1081bb3eda3b737680188d3c337033dd` |
| 2 Живая среда | [`/p/2`](https://wallet.153.76.194.160.nip.io/p/2) | 4 | [`slot-2.appearance.json`](./slot-2.appearance.json) | `89f03a4a57802801484de9a6260ee7bffb8506c2c29bd8aa12ab4ba31e1a1f0f` |
| 3 Светлый | [`/p/3`](https://wallet.153.76.194.160.nip.io/p/3) | 3 | [`slot-3.appearance.json`](./slot-3.appearance.json) | `e881bdf9bb5d911c963cc8763897e88f7be88e52e087be85a3aaa7b4c0f40f08` |
| 4 Терминал | [`/p/4`](https://wallet.153.76.194.160.nip.io/p/4) | 3 | [`slot-4.appearance.json`](./slot-4.appearance.json) | `6fc456907892b7c228b69fa32cb4c05f39240b3ddbe3927675035ef0de32bc20` |
| 5 Минимал | [`/p/5`](https://wallet.153.76.194.160.nip.io/p/5) | 2 | [`slot-5.appearance.json`](./slot-5.appearance.json) | `d2ad0bb7f5a1468a5f988164dd6c0795fb94f96e38c05707d00e4a1feb1a7b21` |
| 6 Мягкое стекло | [`/p/6`](https://wallet.153.76.194.160.nip.io/p/6) | 2 | [`slot-6.appearance.json`](./slot-6.appearance.json) | `fa28ef391bebed4c0d6b10ba545827d9b9a9d60d46b2b5dede47ae8217f65bad` |
| 7 Фирменный | [`/p/7`](https://wallet.153.76.194.160.nip.io/p/7) | 2 | [`slot-7.appearance.json`](./slot-7.appearance.json) | `f0d849c91bab93f6042f648fb7ad74ac880bb958a672f431c07aba724ffed23e` |

**Observed divergence:** slot 2 is public revision 4, updated 2026-10-01T13:02:19.861Z; the prior 2026-10-01 release handoff recorded revision 3. Its appearance changed. Slots 1 and 3–7 remain semantically equal to that handoff. The newer public revision is archived here; nothing was rolled back or republished.

For recovery, verify the file hashes, compare with the **current** server revisions, and use the application's explicit publication flow. Do not replay the archived revision as an overwrite instruction. Public code remains `800a637e0559bfe585df4e2732f4bb14435b0a1f` until a separately authorized release.
