# Receive — логотипы, лёгкое стекло и плавный выбор

Прямое замечание владельца 2026-10-03: вместо букв нужны логотипы валют, убрать видимое «Извне», меньше квадратов, заметнее стеклянный материал, мягкий переход Основной↔Хранилище. Размер/поведение компактного меню предыдущей волны приняты.

Canonical: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`, base `0f31e1d`, runtime `06bddfd`. Одна узкая UI-задача существующему UX Astra MAX, затем ORACLE только проверка типов/сборка. Read-only SOL6.1 MAX ищет provenance SVG. Не расширять в новый framework/Lab или финансовую механику.

## Исполнитель UX

Owned: `apps/miniapp/src/mono-product/receive-menu.tsx`, `.module.css`, `.test.tsx`; новый маленький currency-logo registry/component рядом, статические SVG/лицензия/provenance в `apps/miniapp/public/media/currency-logos/`, точная добавка в `THIRD_PARTY_NOTICES.md`. Не менять global ProductGlassSurface/renderer, controller, sheet, drafts, presets, верхние действия и батарейку.

- BTC/ETH/USDC: настоящие узнаваемые SVG, локальные файлы, без CDN/runtime fetch/нового package. Root передаёт pinned primary source и проверенную лицензию. Allowlisted mapping по `assetId`, не подмена route по symbol/network. Обе сети USDC используют один logo и отдельные подписи сети. Не менять цвета/форму самих знаков ради темы; цвет logo — идентичность актива, не финансовый статус. SVG проверить на scripts/foreignObject/external references, зафиксировать source commit/hash/наши изменения. Для неизвестного asset оставить честный generic fallback. Сохранить aria-label маршрутов, decorative image alt=""/aria-hidden не дублирует текст.
- Видимое «Извне» убрать. Accessible method «Внешнее получение» можно сохранить. «Между счетами» остаётся понятным коротким признаком внутреннего маршрута. Сеть не скрывать.
- Убрать тяжёлую per-button плашку выбранного account и прямоугольный hover/focus fill у валют. Сделать один общий подвижный indicator/lens за выбранным названием: низкая прозрачность, мягкая локальная кромка/свет, без толстого outline. Hit areas44 и keyboard focus-visible остаются. Не уменьшать hitbox ради маленького рисунка.
- Account indicator: один непрерывный переход transform/position между пунктами около240–280ms, `cubic-bezier(.2,0,0,1)`, zero overshoot. На initial mount/resize не проигрывать ненужный перелёт; быстрые переключения latest state, без stale таймеров. Смена группы иконок — короткое конечное проявление (до160ms, ≤2px), без двух одновременно интерактивных групп. Иконка hover/tap/focus — едва заметный подъём/свет или press, без вращения логотипа/бесконечных glints. Native CSS/существующие средства, без новой библиотеки, persistent RAF или loop. Static/reduced отключают spatial motion/transition, но active state остаётся ясным.
- Больше стекла ТОЛЬКО у этого menu: через scoped CSS поверх сохранённого ProductGlassSurface/shared optical host. Уменьшить серую/чёрную вуаль, облегчить тень, мягкие закругления и неравномерный блик кромки; фон должен читаться сквозь поверхность, текст — поверх. Не force fallback, не менять shader uniforms/approved optical JSON/7presets, не добавлять canvas. Для fallback blur честно fallback, opaque/forced-colors/reduced-transparency сохранить. Не делать прозрачный текст ради ощущения стекла. Light theme учесть локально без глобального rewrite.
- Geometry/anchor, outside/Escape/trigger toggle, Back focus,204px stable groups и полный Receive screen06bddfd не переписывать. Если уменьшение пустого ряда возможно без jumps — максимум малая scoped корректировка, не новый placement algorithm.
- Один focused RED/GREEN: реальные local logos/fallback, отсутствие видимого «Извне», selected account/marker и сохранность exact callback, reduced/static. Существующий receive-menu scoped файл можно прогнать один раз; не повторять integration/Send/Receive/history suites. Root делает один source read + browser visual. Коммит только exact owned paths, затем короткий report/commits/checks. Не build/server/push/deploy. Никаких новых helpers/обзоров без конкретной нужды.

## ORACLE после handoff

Только один miniapp typecheck и production preview build/start в канонической копии. До handoff/root source read сохранять текущий3184. Предупредить root перед stop, вернуть READY source SHA/buildID. Не менять внешний сервер, чужой next-env.d.ts, пресеты, чужие tests. Если конкретный дефект — одна адресная поправка и затронутая проверка; без review ladder.

## Источники

Root проверяет primary SVG/лицензию, запись выбранного pinned набора и различие copyright/trademark остаются с assets. Генерировать растровые логотипы не требуется: статические SVG точнее на малом размере и не меняют узнаваемые знаки.

Выбран `spothq/cryptocurrency-icons`0.18.1, commit `1a63530be6e374711a8554f31b17e4cb92c25fa5`; repo LICENSE.md — CC0-1.0. Это единообразные сторонние изображения логотипов, не официальный brand kit. Альтернативы: `0xa3k5/web3icons` (MIT, больше комплект); прямые Ethereum/Circle brand kits (разные условия, Circle не общий permissive источник). CC0 не передаёт права на товарные знаки и не означает endorsement/brand permission; не заявлять обратного.

Raw root: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/1a63530be6e374711a8554f31b17e4cb92c25fa5/`; файлы `svg/color/btc.svg`, `svg/color/eth.svg`, `svg/color/usdc.svg`, `LICENSE.md`. Root прочитал SVG payload и полный LICENSE, SVG только paths/circles, без scripts/foreignObject/external refs. Exact source SHA256:

- btc `5A8131ECDF855B12CB56080AEEEEFEA266976529C45B2D58C284A13B7519F4CA`
- eth `1F94DF8533F61806F7B17EAF9CD28678CDBA66E1D82A9CA8F9FB38D35A907E9C`
- usdc `7281E8CADFE9ABC14E98B15B05CDC24CC24D68533A51E746141D4D98F2CA2BC8`

Суммарный upstream объём2932B, viewBox32×32. Скопировать текстовые SVG через apply_patch без изменения artwork; если локальный newline отличается, записать этот факт и local hash отдельно, не притворяться byte-identical source. Сетевые URL нужны только provenance, runtime исключительно локальный.
