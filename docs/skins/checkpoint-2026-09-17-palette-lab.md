# Checkpoint: MONO Palette Lab — 2026-09-17

Это точка безопасного продолжения после остановки по просьбе владельца.

## Где работаем

- Worktree: `C:\Users\iwwa\Documents\1BANK\.worktrees\26-integration-review`
- Branch: `codex/skin-lab-v2`
- План: `docs/superpowers/plans/2026-09-17-mono-palette-lab-presets.md`
- Spec: `docs/skins/palette-lab-v1.md`
- SDD ledger: `.superpowers/sdd/2026-09-17-mono-palette-lab-presets/progress.md`

## Что завершено

### Baseline

Commit `ddd6f70` зафиксировал весь существовавший MONO workbench, deployment docs,
fonts, optical implementation/tests и новую Palette Lab spec. Перед checkpoint:

- `@wallet/ui`: 133/133 tests;
- `@wallet/miniapp`: 11/11 tests;
- miniapp typecheck: PASS.

### Task 1 — чистый palette engine

Commit `cd86df0` (`Добавить OKLCH-движок и схему палитры MONO`) добавил:

- sRGB ↔ OKLab/OKLCH и gamut mapping;
- alpha compositing и WCAG contrast;
- `MonoPaletteConfigV1`, независимые Dark/Light branches и 24 semantic roles;
- пять harmony recipes;
- linked/offset/manual roles;
- parent/role locks с resolved snapshots;
- protected system roles;
- deterministic global/group/point randomization;
- Apply validation и linked contrast repair;
- public exports и superseding docs для нового hue-решения.

Проверки Task 1:

- focused: 20/20;
- full `@wallet/ui`: 153/153;
- `@wallet/ui` typecheck: PASS;
- `git diff --check`: PASS;
- отдельное task review: Approved, Critical/Important/Minor — none.

Подробности: `.superpowers/sdd/2026-09-17-mono-palette-lab-presets/task-1-report.md`.

## Где остановились

Task 2 (`Workspace, history, persistence и portable presets`) был передан исполнителю,
но остановлен до первого RED и до любых изменений файлов. Worktree на момент остановки
чист. Brief уже создан:

`.superpowers/sdd/2026-09-17-mono-palette-lab-presets/task-2-brief.md`

Следующий исполнитель должен начать от commit `cd86df0` и выполнить три TDD-цикла:

1. Workspace/history: exact Dark/Light restoration, linked/manual freeze, theme link,
   locks, undo/redo branching и slider transaction coalescing.
2. Три независимых versioned storage keys и безопасное восстановление повреждённых данных.
3. Full/partial preset codec с allowlist, diff, lock-preserving merge и SHA-256 content hash.

Важные границы:

- использовать Task 1 engine/types, не дублировать palette math;
- `linkedThemes` — editor state; связывает character axes, но не exposure/contrast;
- lock устанавливать через `setMonoPaletteLock`, чтобы сохранить snapshot;
- FNV из palette engine — replay metadata, не cryptographic preset hash;
- approved Ledger optics и живой UI пока не менять.

После Task 2: отдельное review, затем Task 3 — semantic CSS token bridge и Color Lab UI.

