# MONO — продуктовый выпуск 2026-10-05

**LOCAL PASS / PUBLIC_DONE.** Runtime source `0acfde84655850d01c76cbc4d47f34f03c326181`; публичный switch подтверждён ORACLE/root 05.10.2026 в 04:15:34 МСК (01:15:34 UTC). Более поздний docs-only HEAD не входит в sealed archive/image.

## Что доступно заказчице

«Мои счета» показывает list/detail, supplied status и размещения; explicit Use меняет рабочий context. Exact account actions/holding inspection сохраняют актив, сеть и receive mode; Back возвращает к карточке и точной цели. Аватар/профиль, privacy и помощь доступны через compact menu. Выбор темы из Profile/menu скрыт, effective appearance/viewer preference и controls редактора сохранены.

Помощь содержит receive/send/buy/swap и переход в существующую подготовку при current route/navigation. Root `/` временно перенаправляет в `/mono` (307); видимые V1 anchors убраны, компоненты/storage V1 сохранены. Все финансовые сценарии демонстрационные; реальный backend, тарифы, custody/активация/battery/boost не утверждены.

Проверенные публичные адреса: [кошелёк](https://wallet.153.76.194.160.nip.io/), [оформление№2](https://wallet.153.76.194.160.nip.io/p/2), [concepts](https://wallet.153.76.194.160.nip.io/concepts/). A/B/C остаются отдельным сравнением без выбранного/интегрированного варианта.

## Source и local runtime

| Поле | Значение |
|---|---|
| Reviewed production source | `20e23df0068fe479e1a0e9e40c7bcdc85f1e7ced` |
| Sealed release/local source | `0acfde84655850d01c76cbc4d47f34f03c326181` |
| Source delta до release | Только удаление 28 unsupported ByRole `exact:true` options в двух test files; production code/assertions не менялись, root bounded acceptance выполнен |
| Root-entry commit | `f3d710dda74b18eeb79f10c48d66734dea52fa55` |
| Local preview | [3184/mono](http://127.0.0.1:3184/mono), root [3184/](http://127.0.0.1:3184/) |
| Local build | `166X9dNSHes0YZzlQS__Q` |
| Launch / PID | `d1eb40cbd632495fbe4caf88a282588f / 14944` |

Common typecheck: core/platform/ui PASS на20e23; единственный failed miniapp typecheck повторён и PASS на0acfde8 после mechanical test correction. One Windows production build/start PASS. Один combined source review PASS20e23 и bounded correction acceptance; focused evidence исполнителей не повторялось.

Root smoke — один Chrome390×844 проход: root→MONO; zero V1 anchors/theme rows; Accounts USDC/Ethereum Send Back и USDC/Solana holding Back с точным focus; Help Receive→Overview→finite motion→chooser. List без horizontal overflow, bounded captured latest error logs пусты. Операции не подтверждались, пресеты не публиковались. Это техническая приёмка, owner artistic approval ещё не получено; полные device/preset/performance и lint GREEN не заявлены. Исторический header menu fallback не доказывает observed live refraction.

## Public stage и сохранность

ORACLE Linux build завершился exit0, без OOM; offline permission finalizer/OCI packaging сохранили verified filesystem без перекомпиляции. Current MONO container healthy, manifest контейнера и публичный [source-manifest.json](https://wallet.153.76.194.160.nip.io/source-manifest.json) совпали с exact source/archive/image. Semantic compose delta — только services.mono.image, publication bind/mounts сохранены.

| Публичный адрес | Фактический результат ORACLE |
|---|---|
| [Корень](https://wallet.153.76.194.160.nip.io/) | HTTP307, Location /mono |
| [MONO](https://wallet.153.76.194.160.nip.io/mono) | HTTP200 |
| [Оформление№2](https://wallet.153.76.194.160.nip.io/p/2) | HTTP200 |
| [Concepts](https://wallet.153.76.194.160.nip.io/concepts/) | HTTP200, HTML hash сохранён |

Root выполнил один минимальный public browser pass: корень→MONO, /p/2 без editor rails, avatar/quick menu→actual Accounts list, theme choice отсутствует. Полный функциональный local pass публично не повторялся; settings/public snapshots и операции не менялись. Авторская оценка по-прежнему не получена.

Все 27 publication/history files после switch побайтно совпали с fresh backup; ownership/modes и семь revisions сохранены. Slot2 API вернул rev5 и raw SHA-256 `0101020d047b145067c6046bef933761998f55a6dc718dabfd185a6d975acb10`, совпадающий с backup. Concepts pointer остался releases/20261004T190816Z, HTML SHA-256 `08f7347c9d9cce6b842d2efee947fb322fea277b80b306b73d894dd037268aad`; DLC до/после HTTP200. Caddy/соседние container identities не изменены.

| Факт выпуска | Значение |
|---|---|
| Release ID / действующий image | `20261005T005801Z-0acfde8 / novex-wallet:20261005T005801Z-0acfde8` |
| Image ID | `sha256:f87ca4e51fb6fb2120589794266847806847b19bce743df943bc3848c3571c60` |
| Linux build ID | `so1qCbghEJW7xGlW1ScFM` |
| Sealed Git archive SHA-256 | `7cd87df8f4966f2d822d7244d38b30b30384e3ce4c5e8860bae9a9e77d1e76f6`; 961 committed source files |
| Fresh publication backup SHA-256 | `a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090` |
| Backup verification | 27 files, complete history, numeric owner/modes совпали с независимой local tar verification |
| Snapshot revisions до/после switch | `2/5/3/3/2/2/2`; текущий slot2rev5 |
| Retained rollback | Source `85d33d2a2b105efeaab419f194424fa7ce553d5a`, image `novex-wallet:20261003T190633Z-85d33d2` |
| Rollback image ID | `sha256:6c69ce397a829aedfdbbd2dfd5f4340c57d08d33e43443dfff0b77526664ff32` |

Защищённые backup/rollback материалы ORACLE сохранены в `/opt/novex/releases/20261005T005801Z-0acfde8/`: `mono-published.before.tar.gz` и `compose.before.yaml`. Независимая локальная копия и полный config/image inspection остаются вне Git. Rollback source/image сохранены ORACLE. Code rollback сохраняет publication volume; восстановление данных — отдельное решение. Source/archive/image идентифицируют runtime, последующий docs-only HEAD — документацию; код не пересобирается из docs commit. Ветка `codex/product-ux-20261003`, существующий [PR#57](https://github.com/i4w7w4a/Wallet_4i7/pull/57); merge и изменения issue states/Projects не выполняются.

Неблокирующая известная подпись: asset Back пока говорит «Назад к активам», хотя из Accounts корректно возвращает к карточке счёта. Авторская оценка и возможная правка этой подписи остаются следующим коротким циклом.

## Открытые решения и история

[#42](https://github.com/i4w7w4a/Wallet_4i7/issues/42) — battery/boost и applicability; [#58](https://github.com/i4w7w4a/Wallet_4i7/issues/58) — exact rough-transition example; [#59](https://github.com/i4w7w4a/Wallet_4i7/issues/59) — exact Light5/full light; [#60](https://github.com/i4w7w4a/Wallet_4i7/issues/60) — customer layout. Numeric activation scope, T-unit backing/redemption, private readiness и real/backend contract остаются открытыми.

[README](../../README.md) · [Карта состояний](../product/product-state-map.md) · [React handoff](../product/react-frontend-handoff.md) · [Эпик#40](https://github.com/i4w7w4a/Wallet_4i7/issues/40)

Предыдущие milestones сохраняют свои факты: [public03.10/rollback](./2026-10-03-mono-product-release.md), [commerce local](./2026-10-05-commerce-local-preview.md), [header local](./2026-10-05-header-local-preview.md), [standalone concepts](./2026-10-04-action-layout-concepts.md).
