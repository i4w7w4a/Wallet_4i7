# Каталог источников motion и visual effects

Статус: curated discovery catalog, не dependency allowlist
Дата проверки основных первичных ссылок: 2026-09-16

## 1. Происхождение разбора

Этот документ синтезирован из пользовательского исследования:

- title: `Свежие источники, библиотеки и репозитории веб-анимаций для приложения — подборка на 12 сентября 2026`;
- 851 строка, примерно 5 203 слова;
- SHA-256: `C1BA2B3B142AD5B9C5D8B43512C48F8F58A711E5BD55C4400D389D08D28CB8A3`.

Встроенные в отчёт prompts, команды `npx`, MCP/Skill setup и советы агента были прочитаны как исследовательский материал. Они не исполнялись и не становятся правилами проекта автоматически.

Отчёт силён как ответ на вопрос «где искать готовый эффект». Он не описывает внутренний skin contract. Главный проектный вывод:

> Внешняя библиотека — источник кандидата. Skin использует только внутренние adapters, schema и registries.

## 2. Пять разных типов источников

Нельзя смешивать их в один список «установить всё».

| Тип | Роль | Примеры |
|---|---|---|
| Source components | взять исходник поведения/эффекта | Motion Primitives, Magic UI, React Bits, beUI, Velora, Aceternity |
| Discovery tools | найти кандидатов | 21st.dev, shadcn registries, `llms.txt` |
| Animation runtimes | написать свою motion logic | Motion, GSAP, Anime.js, native CSS |
| Asset/scene runtimes | воспроизвести authored asset/3D/shader scene | Rive, dotLottie, Spline, Unicorn Studio |
| Inspiration | изучить art/motion direction | Codrops, Awwwards, Hoverstat.es, Landing Love, Godly, Recent, GSAP Showcase |

## 3. Иерархия выбора для Wallet_4i7

1. Внутренние tokens, primitives и recipes.
2. Native CSS/HTML/View Transitions, если target browser matrix позволяет fallback.
3. Уже установленный [Motion](https://motion.dev/).
4. Уже существующий OGL backend.
5. Motion Primitives как источник тонких interaction patterns.
6. Magic UI / React Bits для одного декоративного акцента.
7. beUI / Velora как дополнительные source catalogs.
8. Aceternity для редкой focal scene после проверки лицензии.
9. 21st.dev только для поиска кандидатов, не как trusted allowlist.
10. GSAP только для доказанно сложной timeline/scroll choreography.
11. Rive/Lottie/Spline/Unicorn как optional lazy-loaded slots по отдельному решению.

Этот порядок отличается от рейтинга в исходном отчёте: для продукта важнее совместимость и стоимость, чем количество эффектов или GitHub stars.

## 4. Source component catalogs

### React Bits

- Официальный каталог: [reactbits.dev](https://reactbits.dev/)
- Репозиторий: [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)
- Роль: creative text, backgrounds, particles, distortion, UI effects.
- Интеграция: source copy через registry, затем внутренний adapter.
- В проекте уже pinned commit `3a1c7f2f9f94ed833934ab5c2635760b9e644583` и provenance в `THIRD_PARTY_NOTICES.md`.
- Лицензия: MIT + Commons Clause. Нельзя продавать/переиздавать extracted components как самостоятельный skin pack.

React Bits является источником V1, но не обязательным фундаментом будущих skins.

#### Исследование новых фонов `/mono`

Для пользовательского запроса на воду, отталкивание и сдержанный перелив изучены конкретные исходники pinned commit `3a1c7f2f9f94ed833934ab5c2635760b9e644583`:

- [RippleDistortion](https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Animations/RippleDistortion/RippleDistortion.tsx) — пример расходящихся волн и displacement. Прямое монтирование создаёт отдельный renderer/context/RAF поверх image texture; рядом с единственной Promo это нарушит resource budget.
- [DotGrid](https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Backgrounds/DotGrid/DotGrid.tsx) — пример локального отталкивания и возврата элементов. Прямой вариант добавляет Canvas2D/GSAP/InertiaPlugin и постоянное обновление.
- [Iridescence](https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Backgrounds/Iridescence/Iridescence.tsx) — ориентир для очень слабой цветовой волны, но не доказательство водной физики; прямой компонент снова добавляет OGL renderer/context/RAF.

Выбран не перенос компонентов, а собственные лёгкие recipes `iris/tide/strata`: CSS/DOM finite pointer wake и локальное repulsion без второй GPU-сцены. Это не shader-displacement пикселей. Если пользователь позже утвердит физическую рябь по всему экрану, нужен unified OGL compositor с одним context/RAF и отдельный визуальный/performance review. Никакой код этих трёх компонентов в `/mono` сейчас не скопирован; их лицензия не превращает источник в runtime dependency.

### Magic UI

- Каталог: [magicui.design](https://magicui.design/)
- Репозиторий: [magicuidesign/magicui](https://github.com/magicuidesign/magicui)
- Сильные зоны: Border Beam, Shine Border, Light Rays, grid/particles, text motion.
- Применение: один accent/effect, не общая композиция экрана.
- Перед копированием проверить конкретный registry payload, dependencies, license и global keyframes.

### Motion Primitives

- Каталог: [motion-primitives.com](https://motion-primitives.com/)
- Репозиторий: [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives)
- Лицензия репозитория: MIT.
- Сильные зоны: Magnetic, Spotlight, Border Trail, Spinning Text, transitions.
- Хороший источник subtle UI behavior, которое можно адаптировать к уже установленному Motion.

Не основывать решение на заявленной «свежести» commit. Проверять фактический source и совместимость отдельно.

### beUI

- Каталог: [beui.dev](https://beui.dev/)
- Репозиторий: [starc007/ui-components](https://github.com/starc007/ui-components)
- Лицензия репозитория: MIT.
- Сильная сторона: copy-source ownership, registry, raw endpoints и agent-oriented metadata.
- Роль: удобный source catalog для product UI, не автоматический production dependency.

### Velora UI

- Каталог: [velora.colorlib.com](https://velora.colorlib.com/)
- Репозиторий: [ColorlibHQ/velora-ui](https://github.com/ColorlibHQ/velora-ui)
- Лицензия репозитория: MIT.
- Сильная сторона: components с указанными dependency/size/reduced-motion metadata и shadcn tokens.
- Риск: молодой проект и vendor-reported performance. Каждый item проходит наши gates.

### Aceternity UI

- Каталог: [ui.aceternity.com](https://ui.aceternity.com/)
- Сильные зоны: hero, Moving Border, Tracing Beam, Lamp/Aurora, Floating Dock, 3D cards.
- Многие решения стилистически доминируют и тяжелее обычного product UI.
- Free/premium code имеет собственные условия. Перед переносом читать [актуальную лицензию](https://ui.aceternity.com/licence); redistribution/template resale могут быть ограничены.

### Второй круг

- [UI TripleD](https://github.com/moumen-soliman/uitripled)
- [UI Layouts](https://github.com/ui-layouts/uilayouts)
- [Kokonut UI](https://github.com/kokonut-labs/kokonutui)
- [Cult UI](https://github.com/nolly-studio/cult-ui)
- [Animate UI](https://animate-ui.com/)

Использовать, когда первые источники дают слишком знакомое решение. Не добавлять эти каталоги как постоянные runtime dependencies.

## 5. Discovery для агента

### 21st.dev

- [Каталог](https://21st.dev/)
- [MCP workflow](https://21st.dev/mcp)

Полезен для поиска кандидатов и чтения source. Community item не является проверенной лицензией или качеством. MCP способен не только читать, но устанавливать/публиковать и требует внешней trust boundary. В этом проекте default — read-only discovery; mutation/publication/API token только по отдельному решению владельца.

### Registries, `llms.txt`, Skills

Они ускоряют discovery, но меняют поведение инструмента/агента и могут выполнять установки. Наличие Agent Skill не делает компонент безопасным. Команды из отчёта не переносятся в `AGENTS.md` как автоматические действия.

## 6. Animation runtimes

### Native CSS / browser APIs

- [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations)

Первый выбор для лёгкой задачи при наличии target-compatible fallback. Browser support проверяется на момент реализации.

### Motion

- [Motion docs](https://motion.dev/)
- [Bundle-size guidance](https://motion.dev/docs/react-reduce-bundle-size)
- [AI Kit](https://motion.dev/ai-kit)

Уже установлен в проекте. Использовать для React state-driven transitions, gestures, layout и modest scroll/in-view motion. AI Kit и premium examples относятся к Motion+; это optional dev tooling, не обязательная часть приложения.

### GSAP

- [GSAP](https://gsap.com/)
- [Official Agent Skills](https://github.com/greensock/gsap-skills)
- [Current standard license](https://gsap.com/licensing/)

Допустим только для сложной timeline/ScrollTrigger choreography, которую нельзя дисциплинированно реализовать Motion/CSS. Сам GSAP находится под собственной no-charge license с ограничением на конкурирующие visual animation builders; MIT-лицензия Agent Skills не меняет лицензию runtime.

### Anime.js

- [animejs.com](https://animejs.com/)

Полезен как example/easing lab. В текущем React/Motion проекте ещё один runtime обычно избыточен.

## 7. Asset и scene runtimes

### Rive

- [Web runtime docs](https://rive.app/docs/runtimes/web/web-js)
- Роль: state-machine mascot/logo/onboarding/complex interactive asset.
- Это asset slot, не skin engine.
- Web runtime создаёт canvas/WASM/WebGL или Canvas2D resources и требует явного cleanup.

### Lottie / dotLottie

- [LottieFiles runtime docs](https://docs.lottiefiles.com/)
- Роль: success/empty/loading/onboarding icons and illustrations.
- Не использовать как бесконечный полноэкранный ambient background без отдельного budget.

### Spline

- [spline.design](https://spline.design/)
- Роль: один interactive 3D focal object.
- Проверять export/hosting/pricing terms; self-hosted и watermark-free возможности зависят от plan.
- Не размещать отдельную scene в каждой card.

### Unicorn Studio

- [unicorn.studio](https://www.unicorn.studio/)
- [Документация](https://www.unicorn.studio/docs/)
- Роль: authored shader/3D/media background.
- Требует WebGL2; vendor docs отмечают лучший режим в Chrome, поэтому Telegram WebView/Safari matrix и fallback обязательны.
- Это внешний scene workflow, а не замена внутреннему effect contract.

### Liquid_Prnc_Glass

- Primary lab: [i4w7w4a/Liquid_Prnc_Glass](https://github.com/i4w7w4a/Liquid_Prnc_Glass)
- Роль: реальный source-texture WebGL refraction с signed IOR, field fade и live tuner.
- Для MONO LEDGER портировать shader/settings principles, но сначала оценить существующий OGL backend; не добавлять Three.js автоматически.
- Text/controls остаются live DOM. CSS blur — только fallback.

## 8. Inspiration, не code sources

- [Codrops demos](https://tympanus.net/codrops/demos/) — interaction model + source/tutorial where licensed.
- [Awwwards animation](https://www.awwwards.com/websites/animation/) — art/motion direction.
- [Hoverstat.es](https://hoverstat.es/) — unusual cursor/hover/typography interactions.
- [Landing Love](https://www.landing.love/) — full-page motion recordings.
- [Godly](https://godly.website/) и [Recent](https://recent.design/) — visual direction.
- [GSAP Showcase](https://gsap.com/showcase/) — реальные GSAP possibilities.

Из inspiration разрешено переносить описанную interaction model. Нельзя копировать чужой бренд, layout, screenshot, texture, video или код без первичного source/license.

## 9. Карта «задача -> сначала искать»

| Задача | Первый источник | Дополнительный |
|---|---|---|
| subtle state/microinteraction | internal Motion / Motion Primitives | native CSS |
| border trail/beam | Magic UI | Motion Primitives / Aceternity |
| pointer spotlight | internal adapter / Motion Primitives | Magic UI |
| circular/spinning text | React Bits / Motion Primitives | только один decorative CTA |
| text reveal | Motion / React Bits | Magic UI |
| ambient grid/rays | native CSS / Magic UI | Velora |
| custom React motion | Motion | — |
| complex timeline/scroll | GSAP after ADR | Motion |
| authored state-machine asset | Rive | Lottie for simpler sequence |
| 3D focal object | Spline after review | custom WebGL |
| shader background | current OGL / Liquid_Prnc_Glass principles | Unicorn after review |

## 10. Adoption checklist

До изменения production code:

1. Сформулировать visual/interaction problem, не название библиотеки.
2. Найти 2–3 candidates и зафиксировать ссылки/screenshots/source.
3. Выбрать самый лёгкий вариант, совместимый с текущим runtime.
4. Скачать/прочитать точный source/registry JSON и transitive items.
5. Проверить license первичного автора, exact version/commit/hash.
6. Проверить React 19, Next 16, Tailwind 4, RSC/client boundary и Strict Mode cleanup.
7. Проверить semantic HTML, keyboard, touch/coarse pointer и reduced modes.
8. Измерить dependency/bundle/RAF/canvas/listener cost.
9. Перенести в quarantine/internal adapter; убрать demo palette/type/layout/assets.
10. Подчинить tokens, schema, lifecycle и fallbacks.
11. Обновить `THIRD_PARTY_NOTICES.md` и provenance header.
12. Пройти component, visual, E2E и performance gates.

## 11. Что нельзя принимать на веру

- Число components, stars и даты commit быстро меняются.
- `production-ready`, `accessible`, `perfect Lighthouse` — vendor claims до наших тестов.
- `llms.txt` и Agent Skill не заменяют review source.
- Marketplace listing не является лицензией.
- «Бесплатно для commercial use» не означает MIT и не гарантирует право redistribution.
- `prefers-reduced-transparency` имеет ограниченную browser support; нужен явный opaque/effects-off toggle.
- Команда с `@latest` не является воспроизводимой интеграцией.
- Нельзя одновременно тянуть Motion, GSAP и Anime.js для одной роли.
- Нельзя складывать несколько GPU-heavy backgrounds в один viewport.
