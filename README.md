# Novex Wallet

Интерактивный прототип мобильного кошелька и лаборатория оформления MONO. Этот README — вход в актуальное состояние; подробные контракты находятся в технической карте ниже.

## Что можно посмотреть

- «Мои счета» стали компактнее: действия раскрываются по необходимости.
- Средства раскрываются на месте; счёт выбирается сверху, логотип возвращает на главную.
- Значки валют согласованы в средствах, карточке актива и отправке.
- Форма отправки стала читаемее.
- Полоса прокрутки кошелька скрыта; сама прокрутка сохранена.

[Посмотреть кошелёк без редактора](https://wallet.153.76.194.160.nip.io/p/2).

Финансовые сценарии остаются демонстрационными; реальные API и правила операций — отдельный backend-контракт.

## Уровни готовности — 5 октября 2026, 17:49 МСК

| Уровень | Точное состояние |
|---|---|
| Публичный MONO | [Для заказчицы: оформление №2](https://wallet.153.76.194.160.nip.io/p/2), runtime source `9d70abe9da524becc5e4e01d8968536cdeecf315`, image `novex-wallet:20261005T142721Z-9d70abe`. Принятый UX счетов, значки валют, читаемая Send surface и scoped scrollbar fix опубликованы; [точная запись 17:49](docs/releases/2026-10-05-ux-release-9d70abe.md). Корневой вход сохраняет 307 → `/mono`. |
| Локальный runtime / trial | Main [3184/mono](http://127.0.0.1:3184/mono) — exact `9d70abe`, Windows build `ZioBnYJxWqw9IUY83G0cw`. Отдельная [UX-примерка 3190/p/2](http://127.0.0.1:3190/p/2) оставлена: d448 source-at-launch, CSS fix наблюдался через dev HMR. Владелец одобрил примерку d448 и применение с ограниченной правкой scrollbar; фактический public UI проверен минимальным проходом. |
| Отдельные concepts | Публичные A 2+2 / B ряд / C 2 + «Ещё», только сравнение. Вариант не выбран и не интегрирован. |
| GitHub синхронизация | Существующая ветка `codex/product-ux-20261003`, [PR #57](https://github.com/i4w7w4a/Wallet_4i7/pull/57), OPEN/unmerged. Runtime source зафиксирован на `9d70abe`; последующий docs-only HEAD не меняет публичный образ. |
| Backend | Только demo ports/fixtures, без реальных платежей, партнёров и подтверждённых тарифов. Account-kind/T-единицы/активация/battery остаются вопросами к продуктовой стороне. |

Localhost доступен на этом компьютере и не открывается у заказчицы или на отдельном физическом телефоне. После публичного switch все семь published snapshots и полная история сохранены побайтно, текущий slot2rev5. Рабочие пресеты браузера не равны опубликованным `/p/1`…`/p/7`; серверная библиотека `/api/skin-presets` остаётся отдельным неподключённым контуром. Скрытие выбора темы в пользовательском UI сохраняет effective appearance, прежние viewer preferences и controls редактора.

## Техническая карта и решения

- [Карта состояний](docs/product/product-state-map.md) — реализованные состояния и неизвестные backend-стыки.
- [React handoff](docs/product/react-frontend-handoff.md) — компоненты, пять demo ports, Accounts/Help, drafts/accepted lease/history и подключение данных.
- [Текущий выпуск 05.10, 17:49 МСК](docs/releases/2026-10-05-ux-release-9d70abe.md); [предыдущий выпуск 0acf, 04:15 МСК — текущий rollback](docs/releases/2026-10-05-mono-product-release.md).
- Исторические локальные этапы: [header](docs/releases/2026-10-05-header-local-preview.md), [commerce](docs/releases/2026-10-05-commerce-local-preview.md).
- [Исторический публичный выпуск 03.10](docs/releases/2026-10-03-mono-product-release.md); [опубликованные standalone-композиции](docs/releases/2026-10-04-action-layout-concepts.md).
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
