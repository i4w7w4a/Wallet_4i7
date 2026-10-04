# MONO — локальный header/avatar/quick menu

5 октября 2026. LOCAL COMPLETE: header реализован и прошёл один source review, локальный ORACLE gate и связный browser pass оркестратора. Визуальная приёмка владельца и публичный выпуск не подтверждены.

## Что доступно

Avatar с вымышленным demo-портретом открывает профиль. Соседние «Быстрые настройки» содержат только тему, скрытие сумм и помощь. Theme/privacy используют существующих owners; Help открывает фактическую группу профиля и передаёт focus. Escape возвращает trigger, outside action сохраняет своё действие; modal/pending/context/inactive guards остаются в host. Новых финансовых действий, security/identity API или storage нет.

Общий material host сохраняется без дополнительного canvas/context/RAF. В меню просмотренных тем наблюдался fallback; это не evidence живой refraction. Entry конечный, exit0ms принят source review как безопасный tradeoff; возможная мягкость закрытия остаётся визуальным вопросом.

## Точная локальная версия

| Поле | Значение |
|---|---|
| Preview только на этом ПК | [3184/mono](http://127.0.0.1:3184/mono) |
| Runtime source | `00052f959749382e7456f84929dd077244578760` |
| Header commits | `3545288a966cc217f419c05dafb41159f286577d` + `00052f959749382e7456f84929dd077244578760` |
| Build ID | `deRVeNpCsPbioxkeO8M74` |
| Launch ID | `acd41d4599184e1fb2c7f8d604e2660c` |
| PID / порт | `20108 / 3184` |

Localhost не открывается на отдельном физическом телефоне или у заказчицы. Docs-only commit не означает новый runtime. Commerce и пять stable ports/accepted lease/history сохранены; предыдущий [commerce milestone](./2026-10-05-commerce-local-preview.md) остаётся историческим c0f.

## Evidence и границы

По отчётам: avatar6, menu2 + integration7 focused GREEN; после фактического исправления повторён только integration7. Один header source review PASS, miniapp typecheck и одна production build/start ORACLE PASS. Root один раз прошёл dark390/light320, theme/privacy, Help/focus, Escape/outside и avatar→profile; main source badge00052 и saved preset2 сохранены.

Общий lint GREEN **не заявлен**: прежний `react-hooks/immutability` в asset scrollport (`mono-scene.tsx:241`) вне header scope. Полная device/preset/performance-матрица и измеренная производительность не заявляются; source review и build не являются owner approval.

Public MONO остаётся source `85d33d2a2b105efeaab419f194424fa7ce553d5a` ([выпуск03.10](./2026-10-03-mono-product-release.md)). [Standalone concepts](https://wallet.153.76.194.160.nip.io/concepts/) работают отдельно, вариант не выбран/не интегрирован. Новые motion/commerce/header не публиковались; snapshots/history не переписывались.

GitHub API на этом срезе: remote branch/PR #57 head `60356ec`, local00052 ahead19 до docs catch-up. Локальные SHA здесь — идентификаторы, не гарантированные GitHub hyperlinks. Push/merge/deploy не выполнялись.

Открыты: visual feedback и rough-transition example ([#58](https://github.com/i4w7w4a/Wallet_4i7/issues/58)), battery/boost ([#42](https://github.com/i4w7w4a/Wallet_4i7/issues/42)), exact Light5 reference/full light ([#59](https://github.com/i4w7w4a/Wallet_4i7/issues/59)), выбор компоновки ([#60](https://github.com/i4w7w4a/Wallet_4i7/issues/60)) и backend/customer rules. Эти вопросы не становятся новой feature-волной от документации.

[Единый вход](../../README.md) · [Карта состояний](../product/product-state-map.md) · [React handoff](../product/react-frontend-handoff.md) · [Эпик #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40)
