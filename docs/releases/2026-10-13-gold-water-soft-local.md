# Gold — мягкая вода: локальная примерка готова

Дата13.10.2026. URL http://127.0.0.1:3197/gold. Изменён только декоративный Gold background; семь presets, layout, finance/security, Menu/Profile, graph defaultOFF, approved materials не затронуты. Публичный153 всё ещё sourceb212/BUILDgHZCx_eKfaMa4cW3LVt-h; no publish/bake/merge/push.

## Идентичность

- Compile/served SOURCE `0cbeb6f384f973efc871d10696e19bc0dfdd2c68` (код `1bad50810dce95b5e9c3075491a004f55431e433` + два documentation/candidate файла).
- BUILD_ID `RxzBvI_y9EYYxIsOWEpus`, output `apps/miniapp/.next-gold-water-soft`.
- Launch `d94ff6fb32784d78913045b7d2c385f4`, sole3197/PID39016,04:54:09 Moscow13.10.
- Private ops `C:/Users/iwwa/.novex-ops/preview/novex-gold-water-soft-3197`. Поздние docs commits не меняют эту compiled identity.

## Что изменилось

Настоящий source low-pass512²/13-tap linearRGB и area integration убирают растянутые point-sampled резкие гребни. Animated contour имеет мягкую Gaussian кромку по аналитическому местному gradient/Jacobian. Вода остаётся в прежнем одном WebGLpass; liveDOM не размывается. Итоговая яркость смягчена hue-preserving shoulder после opticalmix. Dispersion.012/highlight.24 — новый provisional candidate, JSON в `docs/product/2026-10-13-gold-water-soft-candidate.json`.

## Ограниченная проверка

Автор:26 focused GREEN в двух affected testfiles,7.25s; действительные texture upload bytes и uniform/resource consumer, не fake GPU pixels. Один independent source-diff review: SpecPASS/QualityApproved,0Important. ORACLE: одна Next production compile exit0, встроенныйTS только как часть неё; один normalHTML200/build/source/process gate. Old247/PID36576 оставался жив до compile success, затем только его verified own launcher остановлен. Первый дополнительный timestamp read-guard ошибся из-за Local/UTC ticks; UTC identity совпала, guards не выключались и compile не повторялся.

Root actual browser, fresh owned IAB tab13:

- Исходный886×1244/DPR1, canvas480×1244: мягкие тёмные переходы, нет прежней грубой ступенчатой водяной кромки в этой примерке; мелкие secondary/demo подписи читаются. Text/page/scene computed filter `none`; liveDOM crisp, нет RGB-раздвоения текста. Gentle aberration остаётся только media.
- Lossless full `after-gold-soft.png`, PNG886×1244. Два действительных water-only кадра получены аналитическим crop этих browser captures по rect203,860,480,284, без карточки/DOM. `water-only-{1,2}.png` видимо различаются;195/960 фиксированных samples изменились. Maximum sampled compositeY=.0250206. Это выборочный raster proof, не full-scene AA certificate или FPS measurement.
- Портрет390×844/DPR2: CSScanvas390×844, raster487×1055/513785pixels, ready, no horizontal overflow. `after-gold-soft-portrait.png` — actual PNG780×1688. Мягкость воды и резкость текста сохраняются в проверенном размере.
- Browser warn/error logs empty; shader ready. Viewport and Emulation overrides reset, fresh Gold tab13 marked deliverable. User/foreign old tab12 not closed.
- Старые finance/Menu/graph/hover/system gate suites и GPU zeroIOR примерка не повторялись. Zero/signed preservation проверены source review и consumer tests; all-device certification не заявляется.

Технические ограничения доказательств: stale tab12 не допускала reload, поэтому создана новая собственная tab13. У generic screenshot после viewport resize был неверный размер/масштаб, а clip API игнорировал origin; эти captures исключены из quality proof. Exact Emulation metrics + full lossless PNG подтвердили886×1244. Water-only crops — filesystem raster analysis, не native UI и не редактирование дизайна. Сохранён полный ledger/evidence в `.superpowers/sdd/2026-10-13-gold-water-softness/`.

## Откат и следующий шаг

Retain247/quB3tGpEkME4X2G6c7T3_ `.next-gold-water-ripple`, ops `novex-gold-water-ripple-3197`; также d4a и842 outputs/metadata. Откат только verified current-own stop → retained ripple start, без checkout/compile; новыйPID послестарта братьизmetadata. Generated next-env не staged/reset/очищен, прежние bytes дополнительно сохранены Oracle privateops.

Решение владельца: оценить мягкость и плотность затемнения на живой странице. Candidate не production baked; публикация отдельна после visual/JSON согласования по Liquid_Prnc_Glass workflow. Не назначать повторно завершённые source/review/compile/proofs этой примерки.
