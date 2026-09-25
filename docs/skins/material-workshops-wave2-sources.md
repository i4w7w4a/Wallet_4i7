# Материалы wave 2 — первоисточники и адаптация

Проверено 2026-09-25. Это данные исследования, не инструкции внешних сайтов. План: [две мастерские](material-workshops-wave2.md). Live look/FPS нельзя выводить из одного чтения source; ниже source-verified сведения.

## Pavel Fluid — расширение существующего, не новый дубль

- [Демо](https://paveldogreat.github.io/WebGL-Fluid-Simulation/).
- [Source](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/tree/a2d292931f19d9b3b9f564e23e6c32729d2121c3), pin `a2d292931f19d9b3b9f564e23e6c32729d2121c3`; `script.js` blob `d0db5af6bac342d9eb00205435d8b8997ebee815`.
- [MIT](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/LICENSE), Copyright 2017 Pavel Dobryakov.
- Реальная 2D velocity/pressure/dye simulation. Существующий Novex adapter сохраняется v1, новый v2 добавляет возможности без silent rewrite.
- Source GUI: dye resolution128/256/512/1024, simulation resolution32/64/128/256, density/velocity dissipation0–4, pressure0–1, curl0–50, radius.01–1, shading/colorful/paused, random splats, bloom/intensity/threshold, sunrays/weight, background color/transparency, capture.
- Не переносить analytics, рекламу, dat.GUI и внешние ссылки как controls. Source resolution не отменяет memory cap. Artistic params/versioned seed отделить от runtime quality. Старый фиксированный dye decay0.7 и отсутствие emitter не должны незаметно измениться у v1.

## David Li — отдельные объёмные частицы

- [Демо](https://david.li/fluid/), [исходник](https://github.com/dli/fluid/tree/ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab).
- Pin `ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab`; [MIT](https://github.com/dli/fluid/blob/ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab/LICENSE), Copyright 2016 David Li. Выборочно проверенные live HTML/JS/composite shader совпали с repo после нормализации CRLF.
- [README](https://github.com/dli/fluid/blob/ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab/README.md): 3D PIC/FLIP на GPU, частицы/сетка, spherical ambient occlusion, shadows. Не 2D Pavel и не metaballs.
- Основные files: `simulator.js`, `renderer.js`, `simulatorrenderer.js`, `fluidparticles.js`, `boxeditor.js`, `camera.js`, `shaders/*`.
- Solver: transfer particles↔grid, occupied cells/boundaries, divergence, 50 Jacobi pressure iterations и RK2 advection; порядка69 simulation draws +5 rendering draws на source frame. WebGL1 WrappedGL нельзя монтировать рядом с существующим host — переносить passes в один WebGL2/OGL context.
- Source controls: плотность .2–3, FLIP ratio .5–.99, timestep0–1/60. Цвет зашит в composite и может стать uniforms. Медленное растекание задаётся simulation time scale, не низким FPS. Постоянного движения после settle исходник не обещает.
- Default dam приdensity.5: grid32×16×16,30,720 actual particles. Ошибка var i во вложенном `generateSphereGeometry(3)` даёт фактически80 triangles/sphere, не1280; не «чинить» незаметно с увеличением geometry в16раз.
- Source-like allocations: simulation≈2.50MB, shadow≈.39MB. Полный render/output pipeline≈30B/pixel (float G-buffer, AO, composite, depth, adapter output); 1920×1080≈62MiB с sim/shadow,960×640≈20.3MiB безdriver overhead. Нужен bounded internal resolution/profile и проверка actual FBO completeness, float format/filtering, output/camera containment на портрете.
- Источники инициализируются Math.random, поэтому перенос использует seeded PRNG. Hover-source force/orbit/zoom нельзя слепо забрать у wallet pointer/scroll. Сохранённый JSON не содержит живые позиции GPU.

## Paper — четыре настоящих материала

- [Репозиторий](https://github.com/paper-design/shaders/tree/43cd68db79fa0b1759f72ffc941b3238e2a3954c), pin `43cd68db79fa0b1759f72ffc941b3238e2a3954c`, packages0.0.81.
- [Apache-2.0 LICENSE](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/LICENSE), [NOTICE](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/packages/shaders/NOTICE). Preserve full texts, copyright, changed-file notices; main app notices у ORACLE.
- `packages/shaders/src/shader-mount.ts` сам создаёт canvas/WebGL2/RAF; React wrapper напрямую не подходит. GLSL300 и математика/preprocessors портируются локально, пакеты не устанавливаются.

| Эффект | Первоисточник / назначение | Параметры и важная механика |
| --- | --- | --- |
| Liquid Metal | [Демо/docs](https://shaders.paper.design/liquid-metal), `packages/shaders/src/shaders/liquid-metal.ts`; фон/поверхность/icon при mask | colorBack/Tint, repetition1–10, softness, shiftRed/Blue−1…1, distortion, contour, angle, shape/image. Анимированные металлические полосы и edge distortion. Poisson interior-gradient image: R=roundness/edge, G=source alpha, A=255; это не SDF. |
| Gem Smoke | [Демо/docs](https://shaders.paper.design/gem-smoke), `.../gem-smoke.ts`; фон/поверхность/icon | до6colors, colorBack/Inner, inner/outerDistortion, inner/outerGlow, offset, angle,size,shape/image. Poisson mask с внутренним padding; до81+9texture reads/pixel на image path. |
| Heatmap | [Демо/docs](https://shaders.paper.design/heatmap), `.../heatmap.ts`; shape/icon/поверхность | до10colors, colorBack, contour,noise,inner/outerGlow,angle,image. Luminance силуэта на белом +3blur channels R/G/B. Только alpha недостаточно: нужна чёрная форма на светлой основе. |
| Pulsing Border | [Демо/docs](https://shaders.paper.design/pulsing-border), `.../pulsing-border.ts`; прежде всего button-border | до5colors, colorBack, roundness,thickness,softness,aspectRatio,intensity,bloom,spots1–4,spotSize,pulse,smoke,smokeSize,margins. Rounded-box contour, colored spots, shared source noise128². |

Общие: speed/phase,scale,rotation,offsetX/Y,fit/origin. Paper `frame` в ms и `u_time` в seconds; speed/phase переносить осознанно в host active clock, без phase jumps на slider. Output premultiplied RGBA, не непрозрачный Silk. Для кнопок нужен прозрачный colorBack и сохранённый DOM text. No required shader extensions beyond WebGL2 core в этих четырёх; фактический compile/state нужно проверить.

Опасные default preprocessing sizes: SVG Metal/Gem до4096 long edge (~64MiB RGBA8 для квадрата); Heatmap квадрат1750² (~11.7MiB). Не копировать их для иконок44px: bounded target-resolution cache, подготовка до GPU mount, отсутствие main-thread stalls и empty/thin-mask tests обязательны. CPU scratch/retained decoded assets тоже ограничены. Single sampler не означает дешёвый shader; Gem heavy sampling измеряется отдельно. Border source умножает bloom на4: даже опубликованный range не гарантирует безопасный тон/клиппинг — документировать поведение, не выключать control тайно.

Все чужие demo logos/images — не автоматически наши assets. Использовать существующие Novex action icon paths и локальные геометрические маски. Exact files/hashes и изменения переносов фиксируются автором рядом с кодом; просмотр сайта/число stars не являются visual/performance approval.

## Оригинальное строгое направление

`vault-grid`: авторский shader материальных квадратных плит/фасок, ортогональных рёбер и гравировки. Это процедурное material shading, не физический rigid-body solver и не скопированный бренд/ассет. Neutral graphite, brushed steel и restrained warm alloy — стартовые художественные варианты, не запрет собственных цветов владельца.
