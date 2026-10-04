# MONO — единый продуктовый выпуск

Опубликован 3 октября 2026, 22:21 МСК. [PR #57](https://github.com/i4w7w4a/Wallet_4i7/pull/57) открыт в `codex/mono-release`; feature-ветка отправлена обычным push, merge/default rewrite не выполнялись.

## Ссылки

- [Кошелёк без редактора](https://wallet.153.76.194.160.nip.io/p/1), [второй вариант](https://wallet.153.76.194.160.nip.io/p/2). Постоянные `/p/1`…`/p/7` сохранены.
- [Рабочий редактор MONO](https://wallet.153.76.194.160.nip.io/mono), [витрина](https://wallet.153.76.194.160.nip.io/showcase).
- [Короткий текст для заказчицы](./2026-10-03-client-update.md).
- [React handoff](../product/react-frontend-handoff.md), [карта состояний](../product/product-state-map.md), [план этой волны](../product/2026-10-03-profile-and-release.md).

## Что вошло

Накопленная продуктовая ветка MONO: главная и выбор счёта; активы и размещения по сетям; компактные Receive/Send; демонстрационные отправка и внутренний перевод; история с поиском, фильтрами и квитанциями; battery details; профиль с четырьмя раскрываемыми разделами, privacy и фактической светлой/тёмной темой.

Профиль получает typed resource/actions. Неизвестные состояния защиты не изображаются включёнными. Editor передаёт тему существующему Lab owner; чистый viewer хранит только versioned light/dark preference, не меняя опубликованный envelope. Отдельного переключателя уменьшения анимаций нет по решению владельца; системный reduced-motion сохранён.

Задачи: [#52](https://github.com/i4w7w4a/Wallet_4i7/issues/52), [#53](https://github.com/i4w7w4a/Wallet_4i7/issues/53), [#54](https://github.com/i4w7w4a/Wallet_4i7/issues/54), [#55](https://github.com/i4w7w4a/Wallet_4i7/issues/55); единый выпуск [#56](https://github.com/i4w7w4a/Wallet_4i7/issues/56). Это завершение данного среза, не всего продуктового эпика.

## Точная версия

| Поле | Значение |
| --- | --- |
| Runtime Git SHA | `85d33d2a2b105efeaab419f194424fa7ce553d5a` |
| Image | `novex-wallet:20261003T190633Z-85d33d2` |
| Image ID | `sha256:6c69ce397a829aedfdbbd2dfd5f4340c57d08d33e43443dfff0b77526664ff32` |
| Linux build ID | `RyFbT_cLOS4Skd0L0cxc3` |
| Source archive SHA-256 | `65f27bcbc01bed8763f622029210621378818cb38459ad047d0edce75a37a5e6` |
| Release ID | `20261003T190633Z-85d33d2` |

Последующие documentation-only commits этой ветки не означают новый runtime image. Live identity проверяется по `/source-manifest.json`, а не по самому свежему Git HEAD. Локальный preview 3184 на момент выпуска 03.10 использовал тот же source, но отдельный Windows build ID `sCkDflYnHlcl-QzMMQIjs`.

## Проверки и сохранность

- Исполнители: 41 model check, 10 профильных UI checks; интеграция: 9 theme checks. Пройденные серии не повторялись сборщиком.
- Один общий typecheck, один локальный production build, одна Linux-сборка точного source в mountless контейнере 1 CPU / 2 GiB без Docker socket; exit 0, OOM false. Node 24 Bookworm amd64, pnpm 10.33.2. Упаковка сохранила проверенную файловую систему и manifest, runtime работает от `node`.
- Root browser 390×844: локальный профиль light/dark, связь privacy с главной, компактный Send и вход истории/поиска. Публичный `/p/1`: профиль без редактора, actual light/dark, восстановление темы после reload; `/p/2`: мобильный обзор без Lab chrome. Это браузерная проверка, не проверка на физическом телефоне и не визуальная приёмка владельца.
- Public/container source совпали; `/mono`, `/showcase`, все семь `/p/N` — HTTP 200. Все семь raw snapshot hashes и 26 файлов/history/ownership/modes совпали со свежей резервной копией. Ревизии слотов: `2/4/3/3/2/2/2`.
- В Compose изменён только `services.mono.image`, выполнен mono-only restart без build/pull/dependencies. Соседние container identities и Caddy config не изменились. DLC, Stitch, V1, DNS и данные других сервисов не трогались.

## Резервная копия и откат

Перед выпуском сохранены полный publication volume вместе с history и deployment config. Проверенная копия есть на сервере и локально в закрытом ops-каталоге; секреты/config/data в Git не входят.

- Remote release: `/opt/novex/releases/20261003T190633Z-85d33d2/`.
- Data archive: `mono-published.before.tar.gz`, SHA-256 `ce1958544ace4e60965ecbdbfa3dc9ce1921db3871ca294503bc569d397886ab`.
- Previous Compose: `compose.before.yaml` в том же закрытом release-каталоге.
- Rollback image: `novex-wallet:20261001T085423Z-800a637`.
- Rollback source: `800a637e0559bfe585df4e2732f4bb14435b0a1f`.

При откате кода менять только MONO image/config, сохраняя текущий publication volume. Восстанавливать старые данные автоматически нельзя: после выпуска там могут появиться новые авторские настройки. Сам откат не понадобился.

## Границы и следующий шаг

Финансовые сценарии остаются demo-only. Реальные адреса/QR, подписание и переводы, покупка/обмен/вывод, авторизация, KYC/2FA/пароль и разрешённые адреса этим выпуском не подключены. Подмена snapshot не превращает нынешние demo command ports в production API.

Следующий продуктивный этап — согласовать DTO счетов и профиля, permissions маршрутов, fee/precision/ETA и battery entitlement с backend-разработчиком. Затем подключать один сквозной сценарий: реальные данные → разрешённое действие → подтверждённый результат → история. Визуальные замечания владельца собирать по этим сценариям, не разворачивая новую лабораторию настроек.
