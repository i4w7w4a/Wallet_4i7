# Gold — мягкая тёмная вода, 13.10

Новое решение владельца заменяет резкий светлый water candidate, но не меняет композицию кошелька. Требования: blur только фона, живое преломление с лёгкой аберрацией, затемнение для мелкого текста, убрать грубую пиксельную кромку. Chart defaultOFF, Menu/Profile, семь presets, approved materials и финансовые состояния сохраняются.

Source `1bad50810dce95b5e9c3075491a004f55431e433`, parent `46187692ab61ee890635c72863ce82718cb8b5df`: ровно пять файлов renderer/settings/tests/provenance. Причина: узкие point-sampled гребни256² увеличивались почти до4.86 CSSpx/texel при actual480×1244/DPR1; animated contour width не учитывала местный градиент. Это не CSS upscale и не доказанная ошибка MSAA.

Выбор: интегрированный источник512² с настоящим linearRGB13-tap prefilter; gradient/Jacobian-aware Gaussian contour2.4 CSSpx. Один прежний WebGLpass, без нового renderer/FBO/dependency/цикла. Source≤1MiB, временные typed buffers≤7MiB; прежние drawing786432/DPR1.5/axis2048/30fps caps. Новых slider/visitor editor нет.

Подготовленный source и итоговая optical media затемняются отдельно: hue-preserving shoulder kneeY.016/ceiling.028, provisional budgetY≤.030. CleanIOR0 возвращает подготовленный source без optical additions. Свет/аберрация не действуют на liveDOM. Dispersion.012 и highlightStrength.24 — provisional, остальные16-параметровые значения сохранены. Нормализованный candidate — `2026-10-13-gold-water-soft-candidate.json`; старый candidate остаётся историческим.

Автор:26 focused tests в двух изменённых файлах, exit0,7.25s, RED→GREEN; не fullsuite. Byte/upload/uniform/resource expectations не являются GPU pixel proof. Новый independent diffreview, affected ORACLE compile и root active-browser visual proof фиксируются отдельно в release/ledger. До них runtime247/PID36576 сохраняется; после local примерки требуется новое visual/JSON решение владельца. Public153b212/3184/3196/95/179 не обновлять автоматически; no push/merge/production bake.

Work plan и полная цепочка: `2026-10-13-gold-water-softness.md`, `.superpowers/sdd/2026-10-13-gold-water-softness/` (before evidence, diagnosis, contrast budget, reports/review/actual proof).
