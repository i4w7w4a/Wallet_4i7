# Contained Mobile App Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ограничить всю живую визуальную сцену Wallet_4i7 границами мобильного приложения шириной до `480px`, оставив внешнюю область браузера статичной.

**Architecture:** `wallet-dashboard` становится единым контейнером сцены. Fixed-слои WebThreads и overlays сохраняют viewport-height, но используют общую центрированную ширину `min(100%, 480px)`; WebGL игнорирует pointer вне canvas. Мобильные viewport не меняют композицию.

**Tech Stack:** React 19, Next.js 16, TypeScript, CSS, OGL/WebGL2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-contained-mobile-app-scene-design.md`

## Global Constraints

- Максимальная ширина мобильной сцены: `480px`.
- На viewport до `480px` сцена занимает всю ширину.
- Внешняя область не получает WebGL, тему, шум, glow или pointer-реакцию.
- Не добавлять device frame, Telegram chrome, скругление или тень корневой сцены.
- Сохранить один canvas, один постоянный RAF и существующие reduced/saveData fallbacks.
- BottomSheet и Theme Studio должны покрывать только сцену приложения.
- GitHub-коммиты и отчёты вести на русском языке.

---

### Task 1: Контракт геометрии мобильной сцены

**Files:**
- Create: `apps/miniapp/e2e/dashboard.scene.spec.ts`
- Modify: `packages/ui/src/dashboard/dashboard.css`
- Modify: `packages/ui/src/appearance/wallet-visual-layer.css`
- Modify: `packages/ui/src/primitives/primitives.css`
- Modify: `apps/miniapp/app/globals.css`

**Interfaces:**
- Consumes: существующие DOM-селекторы `.wallet-dashboard`, `[data-wallet-visual-layer]`, `[data-web-threads]`, `.bottom-sheet`, `.wallet-dashboard__theme-overlay`.
- Produces: единый browser-layout contract `scene width = min(viewport width, 480px)`.

- [ ] **Step 1: Написать failing desktop E2E test**

Создать тест, который на `1024×900` проверяет literal-значения:

```ts
const dashboardBox = await page.locator(".wallet-dashboard").boundingBox();
const visualBox = await page.locator("[data-wallet-visual-layer]").boundingBox();
const canvasBox = await page.locator("[data-web-threads]").boundingBox();

expect(dashboardBox).toMatchObject({ x: 272, width: 480 });
expect(visualBox).toMatchObject({ x: 272, width: 480 });
expect(canvasBox).toMatchObject({ x: 272, width: 480 });
expect(await page.evaluate(() => document.elementFromPoint(40, 200) === document.body)).toBe(true);
```

Открыть Theme Studio и demo BottomSheet по отдельности и проверить, что их bounding box равен `{ x: 272, width: 480 }`. На `390×844` проверить `{ x: 0, width: 390 }`.

- [ ] **Step 2: Запустить test и подтвердить RED**

Run: `pnpm --filter @wallet/miniapp exec playwright test e2e/dashboard.scene.spec.ts --config playwright.local.config.ts`

Expected: FAIL — Dashboard и visual layer имеют ширину `1024px`, а внешний point попадает в visual layer.

- [ ] **Step 3: Реализовать единый CSS-контракт**

В `dashboard.css`:

```css
.wallet-dashboard {
  width: min(100%, 480px);
  margin-inline: auto;
}

.wallet-dashboard__foreground {
  width: 100%;
  max-width: none;
}

.wallet-dashboard__theme-overlay {
  top: 0;
  bottom: 0;
  left: 50%;
  width: min(100%, 480px);
  transform: translateX(-50%);
}
```

В `wallet-visual-layer.css` заменить полноэкранный `inset: 0`:

```css
.wallet-visual-layer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 50%;
  width: min(100%, 480px);
  transform: translateX(-50%);
}
```

В `primitives.css` ограничить `.bottom-sheet` тем же способом, а `.bottom-sheet__dialog` сделать шириной `100%`. В `globals.css` оставить `html/body` статичный `#000` и удалить browser-only правило, повторно ограничивающее foreground.

- [ ] **Step 4: Запустить scene E2E и подтвердить GREEN**

Run: та же команда Playwright.

Expected: PASS для desktop и mobile geometry, BottomSheet и Theme Studio.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/e2e/dashboard.scene.spec.ts apps/miniapp/app/globals.css packages/ui/src/dashboard/dashboard.css packages/ui/src/appearance/wallet-visual-layer.css packages/ui/src/primitives/primitives.css
git commit -m "fix(ui): ограничить эффекты мобильной сценой (#23)"
```

### Task 2: Pointer не выходит за приложение

**Files:**
- Modify: `packages/ui/src/react-bits/web-threads/web-threads-engine.test.ts`
- Modify: `packages/ui/src/react-bits/web-threads/web-threads-engine.ts`

**Interfaces:**
- Consumes: `window` pointer listener и `canvas.getBoundingClientRect()`.
- Produces: pointer обновляет `uMouse` только при координатах внутри canvas; вне canvas target active сбрасывается.

- [ ] **Step 1: Написать failing unit test**

Добавить сценарий с canvas `{ left: 272, top: 0, width: 480, height: 900 }`, отправить `pointermove` в `{ clientX: 40, clientY: 200 }`, выполнить RAF и проверить:

```ts
expect(uniforms?.uMouse?.value).toEqual(new Float32Array([0.5, 0.5]));
expect(uniforms?.uMouseActive?.value).toBe(0);
```

- [ ] **Step 2: Запустить test и подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- web-threads-engine.test.ts`

Expected: FAIL — текущий listener нормализует внешнюю координату и активирует mouse uniform.

- [ ] **Step 3: Добавить проверку границ**

До нормализации координат:

```ts
const outside =
  event.clientX < rect.left ||
  event.clientX > rect.right ||
  event.clientY < rect.top ||
  event.clientY > rect.bottom;
if (outside) {
  targetActive = 0;
  return;
}
```

- [ ] **Step 4: Запустить targeted test и полный UI test**

Run:

```bash
pnpm --filter @wallet/ui test -- web-threads-engine.test.ts
pnpm --filter @wallet/ui test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/react-bits/web-threads/web-threads-engine.ts packages/ui/src/react-bits/web-threads/web-threads-engine.test.ts
git commit -m "fix(ui): ограничить WebThreads координатами canvas (#23)"
```

### Task 3: Полная проверка и визуальное доказательство

**Files:**
- Create: `apps/miniapp/e2e/evidence/contained-app-desktop-1024x900.png`

**Interfaces:**
- Consumes: результаты Task 1 и Task 2.
- Produces: воспроизводимый screenshot и полный verification report.

- [ ] **Step 1: Запустить полный quality gate**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
git diff --check
```

Expected: все команды завершаются с exit code `0`.

- [ ] **Step 2: Проверить живой dev runtime**

Открыть `1024×900` и `390×844`, собрать `pageerror`, проверить один `[data-web-threads]` и отсутствие runtime exceptions.

- [ ] **Step 3: Сохранить desktop evidence**

Сделать screenshot `1024×900`, на котором видны статичные боковые поля и эффект только внутри `480px` сцены.

- [ ] **Step 4: Commit evidence**

```bash
git add apps/miniapp/e2e/evidence/contained-app-desktop-1024x900.png
git commit -m "test(miniapp): зафиксировать изолированную сцену (#23)"
```

- [ ] **Step 5: Опубликовать результат**

Push без force в `feat/23-react-bits-dashboard`, оставить в Draft PR #26 русскоязычный отчёт с SHA, RED→GREEN, командами проверок и ссылкой на screenshot. PR не объединять, Issue #23 не закрывать.
