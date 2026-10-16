import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReceiveFlow, type ReceiveDataPort, type ReceiveRoute } from "../receive";
import { ProductAssetDetail, type ProductAssetDetailBattery } from "./product-asset-detail";

const route = {
  action: "receive", receiveMode: "internal-transfer", accountId: "demo-vault", accountLabel: "Хранилище",
  accountKind: "depositary", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
} as const satisfies ReceiveRoute;
const battery: ProductAssetDetailBattery = {
  networkLabel: "Ethereum", chargePercent: 64, remainingTransfers: 3,
};
function createPort(): ReceiveDataPort {
  return { load: vi.fn(async () => ({ status: "ready" as const, data: {
    mode: "internal-transfer" as const, accountId: route.accountId, assetId: route.assetId, networkId: route.networkId,
    sources: [{ accountId: "demo-source", accountLabel: "Основной", assetId: "usdc", networkId: "ethereum", status: "available" as const }],
  } })) };
}
afterEach(cleanup);

it("shows scoped demo battery data with no invented operation and returns through the callback", () => {
  const onBack = vi.fn();
  render(<ProductAssetDetail route={route} battery={battery} onBack={onBack} />);
  expect(screen.getByRole("heading", { name: "USD Coin" })).toBeVisible();
  expect(screen.getByText("USDC")).toBeVisible();
  expect(screen.getByText("Ethereum")).toBeVisible();
  expect(screen.getByText("Хранилище")).toBeVisible();
  expect(screen.getByText("Пример · данные не подключены")).toBeVisible();
  expect(screen.getByRole("meter", { name: "Заряд батарейки" })).toHaveAttribute("aria-valuenow", "64");
  expect(screen.getByText("64%")).toBeVisible();
  expect(screen.getByText("Ожидание появится при отправке")).toBeVisible();
  expect(screen.queryByText("Время уточняется")).toBeNull();
  const how = screen.getByText("Как работает").closest("details")!;
  expect(how).toHaveTextContent("Подходящие счета одной сети используют общий заряд");
  expect(how).toHaveTextContent("подтверждает расчёт перевода");
  fireEvent.click(screen.getByRole("button", { name: "Назад к операции" }));
  expect(onBack).toHaveBeenCalledOnce();
});

it("keeps absent, invalid or wrong-network metadata unknown instead of deriving charge from transfers", () => {
  const { rerender } = render(<ProductAssetDetail route={route} battery={null} onBack={vi.fn()} />);
  expect(screen.getByText("Нет данных")).toBeVisible();
  expect(screen.queryByRole("meter")).toBeNull();
  for (const chargePercent of [null, Number.NaN, Infinity, -1, 101]) {
    rerender(<ProductAssetDetail route={route} battery={{ ...battery, chargePercent }} onBack={vi.fn()} />);
    expect(screen.getByText("Нет данных")).toBeVisible();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.getByText("3")).toBeVisible();
  }
  rerender(<ProductAssetDetail route={route} battery={{ ...battery, networkLabel: "Solana" }} onBack={vi.fn()} />);
  expect(screen.queryByRole("meter")).toBeNull();
  expect(screen.queryByText("64%")).toBeNull();
});

it("preserves explicitly known zero and full charge", () => {
  const { rerender } = render(<ProductAssetDetail route={route}
    battery={{ ...battery, chargePercent: 0 }} onBack={vi.fn()} />);
  expect(screen.getByText("0%")).toBeVisible();
  rerender(<ProductAssetDetail route={route} battery={{ ...battery, chargePercent: 100 }} onBack={vi.fn()} />);
  expect(screen.getByText("100%")).toBeVisible();
});

it("uses only a pending operation estimate and never completes from zero or invalid time", () => {
  const props = { route, battery, onBack: vi.fn() };
  const { rerender } = render(<ProductAssetDetail {...props} operation={{ status: "pending", estimatedRemainingSeconds: 5400 }} />);
  expect(screen.getByText("Примерно 1 ч 30 мин до завершения")).toBeVisible();
  rerender(<ProductAssetDetail {...props} operation={{ status: "pending", estimatedRemainingSeconds: 0 }} />);
  expect(screen.getByText("Перевод в обработке")).toBeVisible();
  expect(screen.getByText("Примерно меньше минуты до завершения")).toBeVisible();
  expect(screen.queryByText("Демо-перевод завершён")).toBeNull();
  for (const estimatedRemainingSeconds of [null, Number.NaN, Infinity, -1]) {
    rerender(<ProductAssetDetail {...props} operation={{ status: "pending", estimatedRemainingSeconds }} />);
    expect(screen.getByText("Время уточняется")).toBeVisible();
    expect(screen.getByText("Перевод в обработке")).toBeVisible();
  }
});

it("shows the supplied operation status without turning preparation or terminal states into a timer", () => {
  const props = { route, battery, onBack: vi.fn() };
  const { rerender } = render(<ProductAssetDetail {...props} operation={{ status: "preparing", estimatedRemainingSeconds: 30 }} />);
  expect(screen.getByText("Подготовка перевода")).toBeVisible();
  expect(screen.getByText("Время уточняется")).toBeVisible();
  rerender(<ProductAssetDetail {...props} operation={{ status: "completed", estimatedRemainingSeconds: 30 }} />);
  expect(screen.getByText("Демо-перевод завершён")).toBeVisible();
  expect(screen.queryByText("Время уточняется")).toBeNull();
  expect(screen.queryByText(/до завершения/)).toBeNull();
  rerender(<ProductAssetDetail {...props} operation={{ status: "failed", estimatedRemainingSeconds: 30 }} />);
  expect(screen.getByText("Демо-перевод не выполнен")).toBeVisible();
  expect(screen.queryByText(/до завершения/)).toBeNull();
});

it("leaves the receive asset/network text static without an asset-details callback", async () => {
  render(<ReceiveFlow route={route} dataPort={createPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  await screen.findByRole("radio", { name: /Основной/ });
  expect(screen.queryByRole("button", { name: /Подробнее об активе/ })).toBeNull();
  expect(screen.getByText("Актив")).toBeVisible();
  expect(screen.getByText("Сеть")).toBeVisible();
});

it("opens asset details from ReceiveFlow without losing a mounted source selection or reloading", async () => {
  const dataPort = createPort(), onDetails = vi.fn();
  function Host() {
    const [details, setDetails] = useState(false);
    return <>
      <div hidden={details}><ReceiveFlow route={route} dataPort={dataPort} privacy={false}
        onBack={vi.fn()} onClose={vi.fn()} onAssetDetails={() => { onDetails(); setDetails(true); }} /></div>
      {details && <ProductAssetDetail route={route} battery={battery} onBack={() => setDetails(false)} />}
    </>;
  }
  render(<Host />);
  fireEvent.click(await screen.findByRole("radio", { name: /Основной/ }));
  const assetButton = screen.getByRole("button", { name: "Подробнее об активе USDC в сети Ethereum" });
  expect(within(assetButton).getByText("USDC")).toBeVisible();
  expect(within(assetButton).getByText("Ethereum")).toBeVisible();
  fireEvent.click(assetButton);
  expect(onDetails).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Назад к операции" }));
  expect(screen.getByRole("radio", { name: /Основной/ })).toBeChecked();
  expect(dataPort.load).toHaveBeenCalledOnce();
});
