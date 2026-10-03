# ProductAssetDetail

Публичный вход `./asset-detail/index.ts`: `ProductAssetDetail`, `ProductAssetDetailProps`, `ProductAssetDetailBattery`, `ProductAssetDetailOperation`. Только presentation внутри текущего popup; своего modal, API, timers или storage нет.

```ts
type ProductAssetDetailProps = {
  route: ProductActionRoute;
  battery: {
    networkLabel: string;
    chargePercent: number | null;
    remainingTransfers?: number | "unknown";
  } | null;
  operation?: {
    status: "preparing" | "pending" | "completed" | "failed";
    estimatedRemainingSeconds: number | null;
  } | null;
  onBack(): void;
};
```

Battery metadata явно демонстрационные. `networkLabel` должен совпадать с route; другой network не раскрывает свои цифры в этом контексте. Charge — только переданное конечное число 0–100, неизвестное/невалидное — «Нет данных», без пустого meter, похожего на нулевой заряд. Transfers не переводятся в процент. Для transfers допустимы только неотрицательные safe integers; неизвестное не равно нулю.

Время принадлежит **текущей операции**, не батарейке. Контракт не имеет полей восстановления/зарядки. Без operation: «Ожидание появится при отправке». Preparing всегда «Время уточняется». Pending использует только предоставленную конечную неотрицательную оценку (до MAX_SAFE_INTEGER секунд), иначе «Время уточняется». Оценка статична; значение 0 не меняет status. Completed/failed выводятся только по status, без продолжающегося ETA. Все эти данные помечены «Пример · данные не подключены»; известная оценка дополнительно названа оценкой демо-операции, не срока сети.

Receive: передать `onAssetDetails` и сохранить ReceiveFlow mounted под `hidden`/`inert` до Back; обычный receive не создаёт operation. Send: host может передать snapshot `onOperationChange` ровно той же структуры. Back/focus return/Escape/trap остаются в host. Новый слой controller здесь не добавлен.

```tsx
<ProductAssetDetail route={selectedRoute} battery={batteryMetadata}
  operation={activeOperation} onBack={returnToMountedFlow} />
```

MONO tokens, CSS Module, targets 44px, короткий конечный transition, reduced motion. Один focused suite `src/mono-product/asset-detail/product-asset-detail.test.tsx`: contract/null/invalid percent, operation ETA/status/back и Receive callback с сохранением source selection. Общая интеграция и browser smoke — у ORACLE.
