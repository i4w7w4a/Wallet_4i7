# Main home port — локальный candidate

**LOCAL READY, 12.10.2026 11:17:14 МСК. PUBLIC NO-GO.**

- URL: http://127.0.0.1:3184/mono.
- Source: **8a9052cb1ecb74d06a41bcd81c0eae36d8d4d88a**, branch `codex/product-ux-20261003`, canonical `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`.
- BUILD_ID: **IXUW6fmHGNaZ7_GMzu3nN**.
- Launch: **7f91263aef134777b31f80633f471c02**; verified listener PID **41420**, loopback `127.0.0.1:3184`, production.
- Одна штатная `scripts/preview/build.ps1`, exit 0/READY; затем guarded `scripts/preview/local.ps1 start -Mode production`. `/api/preview-info` с `no-store` и exact launch прошёл; `/mono` HTTP 200; отдельный durable manager status RUNNING. Producer typecheck/full suite и browser smoke ORACLE не повторял. Bounded main browser smoke координатора завершён PASS; подробности ниже.

## Состав

Три committed source files: spacing `22px`/responsive `12px` и plane CSS priority; product default send wallet icon с original material fallback; reference-equality product original feedback `190ms`/`1px`. Штатный build проверил clean committed runtime paths и отсутствие их изменений во время сборки. Gold prototype3196 и untracked docs/prototypes в этот перенос не входят. Handlers/artwork/material targets/financial rules сохранены.

Сборка выполнена на Windows штатным Node, без Docker, выделения GPU и новых CPU/RAM hard caps со стороны launcher. Native Node/OS defaults не переопределялись этой волной. Это не подтверждение измеренного общего пика памяти всех дочерних процессов.

Foreign `next-env.d.ts` и audit сохранены побайтно: SHA-256 `fdbd4aed25cb869f6dea6a580aae58d5b333805890ce973df3daad9b5c5a9bdc` и `1425ad615b42a3273d4bd253d39bb72cdd5c9ceae535b6e8ae180d08a08f5b3d`. Presets/materials/snapshots/финансовые данные не менялись. Public MONO и опубликованный Boost не переключались; commit/push/merge не выполнялись ORACLE.

## Root browser PASS и local publication config

Координатор проверил фактический host: 390px — gap22, default feedback190ms/1px, plane виден, два pins, horizontal overflow отсутствует. Send открывает прежнее компактное меню, Escape возвращает focus. На320px — gap12, amounts помещаются, expanded funds без overflow. Это bounded review указанного состояния; все семь оформлений не объявлены заново проверенными.

Повторный запрошенный status сохранил RUNNING и тот же source/launch/PID. Одна точечная read-only проверка `/api/mono-published/config` в **11:23:49 МСК** вернула **503, «Публикация не настроена.»**. Это состояние unconfigured local publication API; его UI сводит к «Публикация временно недоступна».

Штатный launcher и publication config/HTTP code побайтно идентичны соответствующим файлам f749. В текущей унаследованной конфигурации отсутствуют четыре publication variables, app/root `.env*` их не задают. Production parser не разрешает HTTP editor origin и development remote/fixture режим; этот loopback production launch публикацию не настраивает.

Предыдущий и текущий saved launch metadata содержат source/mode/launch/PID, но не environment: бывшие inherited values из них доказать или восстановить невозможно. Сохранённая ожидаемая local publish config не обнаружена; новая конфигурация не назначалась, restart не выполнялся, публичный store/snapshots не читались и не менялись. Protected observation — `local-publication-config.json`.

## Локальный rollback

Предыдущий managed process уже завершился до начала этого поручения. Его output сохранён без пересборки: source **f749776562c1e472781d342f52710906c307a7ec**, BUILD_ID **TXp_rhIA5FAna525gCyfN**.

Protected backup: `C:/Users/iwwa/.novex-ops/preview/mono-showcase-3184/main-home-port-8a9052c-20261012/previous-runtime/.next-review`, рядом предыдущие `build.json` и `state.json`.

При откате сначала проверить текущие source/launch/BUILD_ID и остановить только подтверждённый managed3184 штатным launcher. Убрать собственный candidate output в этот же protected run, вернуть сохранённый `.next-review` и прежний `build.json`, затем штатный production start с новым launch. Старые PID/state не восстанавливать как живой процесс; чужие ports, source и данные не трогать. Все resolved move paths должны оставаться в canonical output и этом named protected run. Откат не выполнялся.

Evidence: `before.json`, `build.json`, `state.json`, `foreign-preservation.json`, `local-handoff.json` в protected run; build log `f32c8b56aaf445eb9500117f503a7432.build.stdout.log`, launch logs `7f91263aef134777b31f80633f471c02.*.log` в managed ops root.
