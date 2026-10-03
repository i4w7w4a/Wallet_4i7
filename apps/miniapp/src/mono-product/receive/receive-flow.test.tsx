import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO, resolveActionRoutes, type ProductActionRoute } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceiveFlow } from "./receive-flow";
import { createDemoReceiveDataPort } from "./receive-demo-port";
import type { ExternalReceiveDestination, InternalReceiveDestination, ReceiveDataPort,
  ReceiveDestination, ReceiveLoadResult, ReceiveRoute } from "./receive-types";

const routes = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "receive").routes;
const external = routes.find(route => route.assetId === "usdc" && route.networkId === "ethereum" &&
  route.action === "receive" && route.receiveMode === "external-address")! as ReceiveRoute;
const internal = routes.find(route => route.action === "receive" && route.receiveMode === "internal-transfer")! as ReceiveRoute;
const destination: ExternalReceiveDestination = {
  mode: "external-address", safety: "demo-non-payable", accountId: external.accountId,
  assetId: external.assetId, networkId: external.networkId, reference: "DEMO-NON-PAYABLE:receive-ethereum",
};
const internalDestination: InternalReceiveDestination = {
  mode: "internal-transfer", accountId: internal.accountId, assetId: internal.assetId,
  networkId: internal.networkId, sources: [
    { accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", networkId: "ethereum", status: "available" },
    { accountId: "demo-inactive", accountLabel: "Размещение", assetId: "usdc", networkId: "ethereum", status: "inactive" },
  ],
};

function readyPort(data: ReceiveDestination = destination): ReceiveDataPort {
  return { load: vi.fn(async () => ({ status: "ready" as const, data })) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps account, asset, network and route-back available while loading", () => {
  const pending = deferred<ReceiveLoadResult>();
  const onBack = vi.fn(), onClose = vi.fn();
  const port: ReceiveDataPort = { load: vi.fn(() => pending.promise) };
  render(<ReceiveFlow route={external} dataPort={port} privacy={false} onBack={onBack} onClose={onClose} />);
  expect(screen.getByRole("region", { name: /Получить/ })).toHaveTextContent("USDC");
  expect(screen.getByText("Основной")).toBeVisible();
  expect(screen.getByText("Ethereum")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем реквизиты");
  expect(port.load).toHaveBeenCalledWith({ accountId: external.accountId, assetId: "usdc", networkId: "ethereum",
    receiveMode: "external-address" }, { signal: expect.any(AbortSignal) });
  fireEvent.click(screen.getByRole("button", { name: "Назад к выбору маршрута" }));
  expect(onBack).toHaveBeenCalledWith(external);
  fireEvent.click(screen.getByRole("button", { name: "Закрыть получение" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows an unmistakable non-payable reference, matching network warning and honest QR placeholder", async () => {
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText(destination.reference)).toBeVisible();
  expect(screen.getByText("QR не подключён")).toBeVisible();
  expect(screen.getByText(/Для USDC нужна сеть Ethereum/)).toBeVisible();
  expect(screen.getByText(/Не отправляйте средства/)).toBeVisible();
  expect(screen.queryByRole("img", { name: /QR/ })).toBeNull();
});

it("reports clipboard success only after the browser promise resolves and prevents duplicate writes", async () => {
  const pending = deferred<void>();
  const writeText = vi.fn(() => pending.promise);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  const copy = await screen.findByRole("button", { name: "Копировать демо-реквизиты" });
  fireEvent.click(copy); fireEvent.click(copy);
  expect(writeText).toHaveBeenCalledExactlyOnceWith(destination.reference);
  expect(copy).toBeDisabled();
  expect(screen.queryByText("Демо-реквизиты скопированы.")).toBeNull();
  await act(async () => pending.resolve());
  expect(screen.getByRole("status")).toHaveTextContent("Демо-реквизиты скопированы.");
});

it("keeps the reference available after clipboard rejection without false success", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Копировать демо-реквизиты" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скопировать");
  expect(screen.getByText(destination.reference)).toBeVisible();
  expect(screen.queryByText("Демо-реквизиты скопированы.")).toBeNull();
});

it("degrades missing clipboard/share APIs to readable instructions", async () => {
  vi.stubGlobal("navigator", {});
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "Копировать демо-реквизиты" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Поделиться демо-реквизитами" })).toBeDisabled();
  expect(screen.getByText(/Выделите демо-реквизиты/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Назад к выбору маршрута" })).toBeEnabled();
});

it("shares only the marked demo value and treats cancellation as a recoverable state", async () => {
  const cancellation = new DOMException("cancel", "AbortError");
  const share = vi.fn().mockRejectedValue(cancellation);
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, share });
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Поделиться демо-реквизитами" }));
  expect(share).toHaveBeenCalledWith({ title: "Демо · USDC · Ethereum", text: expect.stringContaining(destination.reference) });
  expect(share.mock.calls[0]![0].text).toContain("НЕ ДЛЯ ОПЛАТЫ");
  expect(await screen.findByText("Меню «Поделиться» закрыто.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Копировать демо-реквизиты" })).toBeEnabled();
});

it("waits for share completion and exposes a recoverable share failure", async () => {
  const pending = deferred<void>();
  const share = vi.fn(() => pending.promise);
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, share });
  render(<ReceiveFlow route={external} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Поделиться демо-реквизитами" }));
  expect(screen.queryByText("Действие «Поделиться» завершено.")).toBeNull();
  await act(async () => pending.resolve());
  expect(screen.getByRole("status")).toHaveTextContent("Действие «Поделиться» завершено.");
  share.mockRejectedValueOnce(new Error("unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Поделиться демо-реквизитами" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось открыть");
});

it("removes private data/QR from the DOM and ignores clipboard completion after privacy changes", async () => {
  const pending = deferred<void>();
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => pending.promise) }, share: vi.fn() });
  const port = readyPort();
  const renderQr = vi.fn(({ value }: { value: string }) => <span data-testid="test-renderer">{value}</span>);
  const props = { route: external, dataPort: port, onBack: vi.fn(), onClose: vi.fn(), renderQr };
  const { rerender, container } = render(<ReceiveFlow {...props} privacy />);
  expect(await screen.findByText("Реквизиты скрыты")).toBeVisible();
  expect(renderQr).not.toHaveBeenCalled();
  expect(container.innerHTML).not.toContain(destination.reference);
  expect(screen.getByRole("button", { name: "Копировать демо-реквизиты" })).toBeDisabled();
  rerender(<ReceiveFlow {...props} privacy={false} />);
  expect(renderQr).toHaveBeenCalledWith({ value: destination.reference, testOnly: true,
    accountId: external.accountId, assetId: external.assetId, networkId: external.networkId });
  fireEvent.click(screen.getByRole("button", { name: "Копировать демо-реквизиты" }));
  rerender(<ReceiveFlow {...props} privacy />);
  await act(async () => pending.resolve());
  expect(container.innerHTML).not.toContain(destination.reference);
  expect(screen.queryByText("Демо-реквизиты скопированы.")).toBeNull();
  expect(screen.getByRole("button", { name: "Поделиться демо-реквизитами" })).toBeDisabled();
});

it("aborts the previous network request and ignores its late data", async () => {
  const pending = deferred<ReceiveLoadResult>();
  const solana = { ...external, networkId: "solana", networkLabel: "Solana" };
  const port: ReceiveDataPort = { load: vi.fn<ReceiveDataPort["load"]>(request => request.networkId === "ethereum" ? pending.promise :
    Promise.resolve({ status: "ready", data: { ...destination, networkId: "solana", reference: "DEMO-NON-PAYABLE:receive-solana" } })) };
  const props = { dataPort: port, privacy: false, onBack: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<ReceiveFlow {...props} route={external} />);
  const firstSignal = vi.mocked(port.load).mock.calls[0]![1].signal;
  rerender(<ReceiveFlow {...props} route={solana} />);
  expect(firstSignal.aborted).toBe(true);
  expect(await screen.findByText("DEMO-NON-PAYABLE:receive-solana")).toBeVisible();
  await act(async () => pending.resolve({ status: "ready", data: destination }));
  expect(screen.queryByText(destination.reference)).toBeNull();
  expect(screen.getByText(/Для USDC нужна сеть Solana/)).toBeVisible();
});

it.each([
  { ...destination, networkId: "solana" },
  { ...destination, accountId: "wrong-account" },
  { ...destination, assetId: "btc" },
  { ...destination, reference: "real-address-not-allowed" } as unknown as ExternalReceiveDestination,
])("fails closed for mismatched or unmarked destination data %#", async data => {
  render(<ReceiveFlow route={external} dataPort={readyPort(data)} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Данные не подходят|Реквизиты не предназначены/);
  expect(screen.queryByRole("button", { name: "Копировать демо-реквизиты" })).toBeNull();
});

it("recovers a rejected load through an explicit retry", async () => {
  const port: ReceiveDataPort = { load: vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ status: "ready", data: destination }) };
  render(<ReceiveFlow route={external} dataPort={port} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить");
  const retry = screen.getByRole("button", { name: "Повторить" });
  retry.focus();
  fireEvent.click(retry);
  expect(screen.getByRole("button", { name: "Назад к выбору маршрута" })).toHaveFocus();
  expect(await screen.findByText(destination.reference)).toBeVisible();
});

it("explains an inactive account without offering address or activation", async () => {
  const port: ReceiveDataPort = { load: async () => ({ status: "unavailable", reason: "account-inactive" }) };
  render(<ReceiveFlow route={internal} dataPort={port} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText("Счёт не активирован")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Активировать|Копировать/ })).toBeNull();
});

it("keeps internal receive distinct and preserves the selected source when going back from review", async () => {
  const onBack = vi.fn(), onClose = vi.fn(), renderQr = vi.fn();
  render(<ReceiveFlow route={internal} dataPort={readyPort(internalDestination)} privacy={false}
    onBack={onBack} onClose={onClose} renderQr={renderQr} />);
  const source = await screen.findByRole("radio", { name: /Основной/ });
  expect(screen.getByRole("radio", { name: /Размещение/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Проверить маршрут" })).toBeDisabled();
  fireEvent.click(source);
  fireEvent.click(screen.getByRole("button", { name: "Проверить маршрут" }));
  const review = screen.getByRole("region", { name: "Маршрут пополнения" });
  expect(review).toHaveTextContent("Основной");
  expect(review).toHaveTextContent("Хранилище");
  expect(review).toHaveTextContent("Комиссия пока неизвестна");
  expect(within(review).getByRole("heading")).toHaveFocus();
  expect(screen.queryByRole("button", { name: /Копировать|Поделиться/ })).toBeNull();
  expect(renderQr).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам-источникам" }));
  expect(screen.getByRole("radio", { name: /Основной/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Проверить маршрут" }));
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Назад к выбору маршрута" }));
  expect(onBack).toHaveBeenCalledWith(internal);
});

it("never renders external details for internal routes or wrong-network sources", async () => {
  const { rerender } = render(<ReceiveFlow route={internal} dataPort={readyPort(destination)} privacy={false}
    onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Данные не подходят");
  rerender(<ReceiveFlow route={internal} dataPort={readyPort({ ...internalDestination,
    sources: [{ ...internalDestination.sources[0]!, networkId: "solana" }] })} privacy={false}
    onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Данные не подходят");
  expect(screen.queryByRole("radio")).toBeNull();
});

it("explains an empty internal-source list without an actionable transfer", async () => {
  render(<ReceiveFlow route={internal} dataPort={readyPort({ ...internalDestination, sources: [] })}
    privacy onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText("Нет доступных счетов-источников")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Проверить маршрут" })).toBeNull();
});

it("rejects a non-receive route before loading data", () => {
  const port = readyPort();
  const send: ProductActionRoute = { ...external, action: "send" };
  render(<ReceiveFlow route={send} dataPort={port} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText("Получение недоступно")).toBeVisible();
  expect(port.load).not.toHaveBeenCalled();
});

it("creates non-payable external demos and requires explicit internal bindings", async () => {
  const options = { signal: new AbortController().signal };
  const port = createDemoReceiveDataPort(MULTI_ACCOUNT_DEMO);
  expect(await port.load(external, options)).toMatchObject({ status: "ready", data: {
    mode: "external-address", safety: "demo-non-payable", reference: expect.stringMatching(/^DEMO-NON-PAYABLE:/),
  } });
  expect(await port.load(internal, options)).toEqual({ status: "unavailable", reason: "sources-not-connected" });
  expect(await port.load({ ...internal, accountId: "demo-inactive" }, options))
    .toEqual({ status: "unavailable", reason: "account-inactive" });
  expect(await port.load({ ...internal, networkId: "solana" }, options))
    .toEqual({ status: "unavailable", reason: "route-unavailable" });
  const bound = createDemoReceiveDataPort(MULTI_ACCOUNT_DEMO, [{ destinationAccountId: internal.accountId,
    sourceAccountId: external.accountId, assetId: "usdc", networkId: "ethereum" }]);
  expect(await bound.load(internal, options)).toMatchObject({ status: "ready", data: {
    mode: "internal-transfer", sources: [{ accountId: external.accountId, status: "available" }],
  } });
});
