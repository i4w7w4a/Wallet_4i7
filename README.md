# Novex Wallet

Интерактивный прототип мобильного кошелька и лаборатория оформления MONO. Этот README — вход в актуальное состояние; подробные контракты находятся в технической карте ниже.

## Что можно посмотреть

- Обновлённый [кошелёк](https://wallet.153.76.194.160.nip.io/) объединяет счета, средства, действия и историю.
- В «Моих счетах» можно просмотреть список, статус и размещения средств, затем выбрать нужный счёт для работы.
- Действия из карточки счёта сохраняют выбранные актив и сеть; получение, отправка, покупка и обмен работают на демонстрационных данных.
- Аватар открывает профиль; быстрые настройки дают доступ к «Моим счетам», скрытию сумм и помощи.
- Помощь объясняет четыре основных сценария и позволяет перейти к доступному действию.
- Отдельная ссылка на [оформление №2](https://wallet.153.76.194.160.nip.io/p/2) удобна для просмотра без редактора.
- [Три варианта композиции](https://wallet.153.76.194.160.nip.io/concepts/) сохранены для сравнения; окончательный вариант ещё не выбран.

## Уровни готовности — 5 октября 2026

| Уровень | Точное состояние |
|---|---|
| Публичный MONO | [Корневой вход](https://wallet.153.76.194.160.nip.io/) → `/mono` (307), runtime source `0acfde84655850d01c76cbc4d47f34f03c326181`, image `novex-wallet:20261005T005801Z-0acfde8`. Accounts/Help, motion/Buy/Swap/header и скрытие theme choice опубликованы; [точный выпуск05.10](docs/releases/2026-10-05-mono-product-release.md). |
| Локальная примерка | [На этом ПК: 3184/mono](http://127.0.0.1:3184/mono), runtime source `0acfde84655850d01c76cbc4d47f34f03c326181`: motion, Buy/Swap, avatar/menu, «Мои счета», actionable Help и корневой вход MONO. Source review, common typecheck/build и один browser smoke выполнены; owner artistic approval не получено. |
| Отдельные concepts | Публичные A 2+2 / B ряд / C 2 + «Ещё», только сравнение. Вариант не выбран и не интегрирован. |
| GitHub синхронизация | Существующая ветка `codex/product-ux-20261003`, [PR #57](https://github.com/i4w7w4a/Wallet_4i7/pull/57). Runtime source зафиксирован на `0acfde8`; последующий docs-only HEAD не меняет публичный образ. |
| Backend | Только demo ports/fixtures, без реальных платежей, партнёров и подтверждённых тарифов. Account-kind/T-единицы/активация/battery остаются вопросами к продуктовой стороне. |

Localhost доступен на этом компьютере и не открывается у заказчицы или на отдельном физическом телефоне. После публичного switch все семь published snapshots и полная история сохранены побайтно, текущий slot2rev5. Рабочие пресеты браузера не равны опубликованным `/p/1`…`/p/7`; серверная библиотека `/api/skin-presets` остаётся отдельным неподключённым контуром. Скрытие выбора темы в пользовательском UI сохраняет effective appearance, прежние viewer preferences и controls редактора.

## Техническая карта и решения

- [Карта состояний](docs/product/product-state-map.md) — реализованные состояния и неизвестные backend-стыки.
- [React handoff](docs/product/react-frontend-handoff.md) — компоненты, пять demo ports, Accounts/Help, drafts/accepted lease/history и подключение данных.
- [Публичный выпуск 05.10 и откат](docs/releases/2026-10-05-mono-product-release.md).
- Исторические локальные этапы: [header](docs/releases/2026-10-05-header-local-preview.md), [commerce](docs/releases/2026-10-05-commerce-local-preview.md).
- [Публичный выпуск 03.10 и rollback](docs/releases/2026-10-03-mono-product-release.md); [опубликованные standalone-композиции](docs/releases/2026-10-04-action-layout-concepts.md).
- [Эпик #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40) — существующий план и текущие решения; [батарейка #42](https://github.com/i4w7w4a/Wallet_4i7/issues/42), [неуточнённая резкость #58](https://github.com/i4w7w4a/Wallet_4i7/issues/58), [полный Light5 #59](https://github.com/i4w7w4a/Wallet_4i7/issues/59), [выбор компоновки #60](https://github.com/i4w7w4a/Wallet_4i7/issues/60).
- [Skin docs](docs/skins/README.md) — оформление и архив лаборатории; [AGENTS.md](AGENTS.md) — рабочие границы.

## Разработка

Node.js 24+, pnpm 10.33.2. Для отдельного clone:

~~~sh
pnpm install --frozen-lockfile
pnpm dev
~~~

В общей рабочей копии текущим production-preview управляет ORACLE; новый сервер не запускается автоматически. Проверки выбираются по изменённому поведению, общий build — на принятом интегрированном source. Успех тестов или сборки не означает визуальной приёмки; эталоны не обновляются автоматически.

В текущем source `/` временно перенаправляет в `/mono` (307); видимые V1-ссылки из MONO убраны. V1 components и versioned ключи `wallet4i7.*` сохранены ради совместимости; нового публичного legacy-маршрута нет. Старые handoff и runbook не являются новым разрешением на deploy.
