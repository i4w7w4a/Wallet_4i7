# Motion R1: подключение

Слой управляет представлением. Данные и команды принадлежат существующему controller; движение не задерживает переход и не хранит outgoing snapshot.

- `motion-patterns.module.css`: класс `scope` задаёт семантические значения — `--motion-press`, `--motion-hover`, `--mono-product-reveal-open`, `--mono-product-reveal-close`, `--motion-navigation`, `--motion-linked-card` и `--mono-product-motion-ease`. CSS-время задаётся в `ms` или `s`; WAAPI понимает те же единицы. Для существующих хозяев без новых переменных сохраняются 280/300 ms и прежняя кривая. `feedback` — короткий цветовой отклик без масштабирования текста, hover только для точного указателя.
- `DisclosureMotion` — управляемое раскрытие с реальной высотой. Его `open`, `id`, `launcherId` и содержимое приходят от хозяина. При закрытии фокус внутри возвращается к launcher до inert; выходящее содержимое остаётся актуальным, а не копией старого ReactNode. Компонент не является модальным окном и не делает focus trap.
- `useLinkedCardMotion` — тонкая обёртка существующего `useProductViewMotion`. Передать стабильный id выбранной сущности или `null` для списка; один текущий DOM находится в непосредственных дочерних элементах `contentRef`. Переход — небольшой сдвиг и fade, без искусственного morph, копии текста или измерения размеров.

```tsx
const surfaceRef = useRef<HTMLElement>(null);
const contentRef = useRef<HTMLDivElement>(null);
useLinkedCardMotion({ surfaceRef, contentRef, detailId: selectedId, enabled: effectsEnabled });

return <main ref={surfaceRef} className={motion.scope}
  data-mono-motion={effectsEnabled ? "ready" : "static"}>
  <div ref={contentRef}>{selectedId ? <Details id={selectedId} /> : <Cards />}</div>
</main>;
```

Хозяин обязан сразу менять identity/данные/privacy и управлять focus/scroll при навигации. Для disclosure передайте доступный launcher и обработайте Escape в соответствующей поверхности. Не используйте этот паттерн для двух одновременно живых форм, сумм, адресов или сущностей без реального соответствия. Не помещайте стабильные шапку/фон внутрь анимируемых детей. Не применяйте scale/blur к читаемому содержимому. Отдельный декоративный объект может получать то же `open` от хозяина; его отсутствие или ошибка не блокирует управление.

Gate `data-mono-motion="static"`, системный reduced motion и hidden document останавливают переходы; они не меняют product state. `enabled` надо связать с реальным effects-off/inactive состоянием хоста. Быстрые переходы отменяют предыдущую WAAPI-анимацию; подписки и animations очищаются при размонтировании. Resize безопасен: переход не измеряет геометрию. Первое монтирование и обновления без смены identity не запускают переход.

Проверить: обычный/reduced/effects-off, системный reduced, быстрые выбор/Back и open/close/reopen, Escape и возврат фокуса, privacy во время перехода, resize и уход вкладки в фон; один доступный текущий DOM и отсутствие невидимого blocker. Примерка: `/design-lab/motion-r1` при `next dev`; в production route возвращает 404. Это синтетическая примерка, не интеграция #73 и не визуальное утверждение дизайна.
