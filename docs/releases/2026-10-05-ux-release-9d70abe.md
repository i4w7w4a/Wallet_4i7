# MONO — принятый UX, 05.10.2026, 17:49 МСК

**Выпуск технически подтверждён.** Deployed05.10.2026,17:49:00 МСК /14:49:00 UTC. Exact runtime source `9d70abe9da524becc5e4e01d8968536cdeecf315`; последующий docs-only HEAD не входит в image. Это следующий выпуск после [0acf,04:15 МСК](./2026-10-05-mono-product-release.md); прежняя запись сохранена как история текущего rollback.

## Для заказчицы

- «Мои счета» стали компактнее: действия раскрываются по необходимости.
- Средства раскрываются на месте; счёт выбирается сверху, логотип возвращает на главную.
- Значки валют согласованы в средствах, карточке актива и отправке.
- Форма отправки стала читаемее.
- Полоса прокрутки кошелька скрыта; сама прокрутка сохранена.

[Открыть кошелёк без редактора](https://wallet.153.76.194.160.nip.io/p/2).

Владелец одобрил UX-примеркуd448 и применение с исправлением wallet scrollbar. Все операции остаются demo; backend/pending/custody/battery semantics и семь пользовательских presets не изменены.

## Source, builds и доступ

| Поле | Точный факт |
|---|---|
| Runtime/source | `9d70abe9da524becc5e4e01d8968536cdeecf315` |
| Accepted trial | `d448079a62b095fd2f0d59363f53cdf84cabeb82` + bounded scrollbar fix9d |
| Inherited accepted slice | `d73eb06b0131fc986d840853b8dc099fb4eb2344`: logo-home, functional disclosure, top account popover |
| Release/image | `20261005T142721Z-9d70abe / novex-wallet:20261005T142721Z-9d70abe` |
| Image ID | `sha256:453fcf63fbf7d70064b3ff9ffc42da849247e625675d88fac8f99d3dd4d574df` |
| Linux BUILD_ID | `a7qutmdWsrKH5C9DKyZ4d` |
| Archive SHA-256 | `0edacb65a3de48de6336673fa59fcd9f498d4a749b5724f501a4ce033dfe9039`;968 committed files |
| Main local3184 | Source9d; Windows BUILD_ID `ZioBnYJxWqw9IUY83G0cw`, launch `e3fbf8f63f8642ee9c104d6460e35e4b`, listener PID40816 |
| Retained trial3190 | Dev fixture /p/2 и /p/3; d448 source-at-launch, CSS correction наблюдался через HMR. Main3184 и trial3190 — отдельные процессы |

Public [source manifest](https://wallet.153.76.194.160.nip.io/source-manifest.json) HTTP200 совпал с exact candidate/source/archive/image. [Корень](https://wallet.153.76.194.160.nip.io/) сохраняет HTTP307→/mono; [/mono](https://wallet.153.76.194.160.nip.io/mono), [/p/2](https://wallet.153.76.194.160.nip.io/p/2) и [/concepts/](https://wallet.153.76.194.160.nip.io/concepts/) HTTP200. Live container healthy. Только services.mono.image изменён; bind mounts/runtime policy сохранены.

## Принятие и пределы проверки

Common typecheck/app production build наd448 и supplied focused cases переиспользованы. Закрыты bounded reviews inherited c307→d73 и trial d73→d448. Final d448→9d — ровно два CSS файла,4 additions/2 deletions, без TypeScript изменений; новый общий review/typecheck не запускался. Один Linux production build и offline permission finalizer exit0 без OOM; packaging сохранил verified filesystem без перекомпиляции. Один Windows build/start main3184 PASS.

Owner visual acceptance относится к UX-примеркеd448 и согласованному применению с scoped scrollbar fix. Trial scrollbar RED/GREEN: wallet content480→470 до correction,480→480 после раскрытия Funds; native PageDown scroll0→148 с сохранённым focus.

Root minimal actual public UI/p2, viewport657×946: видны «На главную», новый account trigger и загруженные локальные BTC/ETH/USDC SVG. Funds closed/open frame/client/page width480; scrollHeight946→1094 при clientHeight946, scrollbarWidth:none и overflowY:auto. Полоса не появилась, ширина не изменилась. Captured console warn/error пусты в bounded наблюдении; операции/settings/presets не менялись. Это дополнение trial, не full повтор all-browser/touch/performance или blanket lint PASS.

Scrollbar rule применяется только к dedicated wallet scrollports viewer/editor в [mono-viewer.css](../../apps/miniapp/src/mono-preview/mono-viewer.css) и [mono-workbench.css](../../apps/miniapp/src/mono-preview/mono-workbench.css). Rails и остальные scrollbars приложения не меняются. Full routes, receiveMode, receive entry без holding и exact return/focus сохраняют прежние guards; artwork/Send surface не меняют финансовые contracts.

## Данные и rollback

Свежий publication/history backup выполнен **после готовности candidate**,05.10.2026 в17:45:27 МСК /14:45:27 UTC, независимо проверен локально до switch. SHA-256 `a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090`; совпадение с прежним hash отражает неизменные данные, а не использование старой копии.

Все27 files/current snapshots/full history, numeric owners/modes до/после switch совпали побайтно. Seven revisions `2/5/3/3/2/2/2`; public slot2rev5, raw SHA-256 `0101020d047b145067c6046bef933761998f55a6dc718dabfd185a6d975acb10` совпал с backup. Preset PUT и финансовых операций не было. Concepts pointer/HTML, Caddy, DLC и neighbour identities не изменены.

Текущий rollback: source `0acfde84655850d01c76cbc4d47f34f03c326181`, image `novex-wallet:20261005T005801Z-0acfde8`, ID `sha256:f87ca4e51fb6fb2120589794266847806847b19bce743df943bc3848c3571c60`. Fresh compose.before.yaml, publication backup и независимая local copy удерживаются в protected ops вне Git. Image rollback сохраняет текущий publication volume; data restore — отдельное решение.85d33 не является rollback этого выпуска.

## GitHub и открытые границы

Существующая feature branch `codex/product-ux-20261003` отправлена обычным non-force push; [PR57](https://github.com/i4w7w4a/Wallet_4i7/pull/57) остаётся OPEN/unmerged. Один [release evidence comment ORACLE](https://github.com/i4w7w4a/Wallet_4i7/pull/57#issuecomment-5996969949) уже содержит доказательства; docs update не создаёт новый image/runtime. Default merge/rebase/force/issue cleanup не выполняются.

[README](../../README.md) · [Карта состояний](../product/product-state-map.md) · [React handoff](../product/react-frontend-handoff.md) · [предыдущий0acf/rollback](./2026-10-05-mono-product-release.md).

Новые live/resource/pending contracts, custody/activation/T-backing, battery/boost и real money/security API в этот UX-выпуск не входят. Static concepts остаются отдельным сравнением без выбранной интеграции.
