# Сторонние компоненты

## Postgres.js

- Пакет: `postgres@3.4.7` — <https://github.com/porsager/postgres/tree/v3.4.7>.
- Автор: Rasmus Porsager и участники проекта.
- Лицензия: Unlicense (<https://github.com/porsager/postgres/blob/v3.4.7/UNLICENSE>).
- Использование: только серверный PostgreSQL driver библиотеки пресетов; браузерный bundle его не содержит.
- Текст лицензии находится в установленном пакете `node_modules/postgres/UNLICENSE`.

## React Bits

- Источник: https://github.com/DavidHDev/react-bits
- Зафиксированный commit: `3a1c7f2f9f94ed833934ab5c2635760b9e644583`
- Copyright (c) 2026 David Haz
- Лицензия: MIT + Commons Clause License Condition v1.0
- Условие: компоненты используются внутри Novex Wallet и не распространяются как отдельная библиотека.

Используемые upstream-файлы:

- `src/ts-default/Backgrounds/WebThreads/WebThreads.tsx` и `WebThreads.css`;
- `src/ts-default/Components/GlassIcons/GlassIcons.tsx` и `GlassIcons.css`;
- `src/ts-default/Components/SpotlightCard/SpotlightCard.tsx` и `SpotlightCard.css`;
- `src/ts-default/TextAnimations/CountUp/CountUp.tsx`;
- `src/ts-default/TextAnimations/GradientText/GradientText.tsx` и `GradientText.css`;
- `src/ts-default/Animations/ClickSpark/ClickSpark.tsx`;
- `src/ts-default/Components/GooeyNav/GooeyNav.tsx` и `GooeyNav.css`.

Содержательные изменения Novex Wallet: controlled callbacks, русская локализация,
доступность, lifecycle/fallback, единая тема и ограничения мобильных ресурсов.
Сырые React Bits-компоненты не экспортируются как самостоятельная библиотека.

### Текст лицензии upstream

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Radiant — Silk Cascade

- Источник: [Silk Cascade](https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/static/silk-cascade.html).
- Commit: `59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40`; source blob: `70741edbdff44f8d9af20a25d82be8fdb53ce2f5`.
- Локальный adapter: `packages/ui/src/background-sandbox/effects/silk/`.
- Сохранены трёхслойный материал, normals, направленный sheen и color composite. Внешний demo runtime заменён OGL-pass на контексте лаборатории; добавлены versioned controls, непрерывная фаза, pointer easing и lifecycle cleanup. Demo UI и scheduling не перенесены.
- Это экспериментальная dev-only песочница. Лицензия, source fidelity и техническая проверка не означают визуального утверждения или выпуска в продукт.

### Текст лицензии upstream

```text
MIT License

Copyright (c) 2025 Paul Bakaus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Pavel WebGL Fluid Simulation

- Источник: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
- Зафиксированный commit: `a2d292931f19d9b3b9f564e23e6c32729d2121c3`
- Адаптация: `packages/ui/src/background-sandbox/effects/fluid/`, OGL passes на контексте host.
- Сохранены velocity/dye/advection/curl/divergence/pressure/gradient subtraction; удалены demo GUI, ads, bloom, sunrays и внешние assets. Dithering процедурный.
- Seeded reset даёт шесть начальных всплесков, затем цвет затухает без новых drag. Control «Затухание течения» меняет velocity; dye decay фиксирован.

```text
MIT License

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Liquid_Prnc_Glass

- Оптический kernel и нейтральный источник выделены без изменения формул в `packages/ui/src/mono/mono-optical-kernel.ts`; lab-only pass использует тот же источник и uniforms в общем OGL context.

- Источник: https://github.com/i4w7w4a/Liquid_Prnc_Glass
- Зафиксированный commit: `97175e083782eab2d55b85abafc6a426c269e20a`
- Copyright (c) 2026 i4w7w4a
- Лицензия: MIT License
- Адаптировано в `packages/ui/src/mono/mono-optical-glass.tsx`: signed optical power, center-to-edge `masterFade`, source-texture refraction и final mix. Код сокращён до monochrome WebGL2/OGL варианта; текст и controls остаются DOM, shader не переносится целиком.

### Текст лицензии upstream

```text
MIT License

Copyright (c) 2026 i4w7w4a

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
