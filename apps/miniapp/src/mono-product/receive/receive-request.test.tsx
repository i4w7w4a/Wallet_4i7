import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceiveFlow } from "./receive-flow";
import { buildReceiveRequestText, normalizeReceiveRequestAmount, RECEIVE_REQUEST_MARKER } from "./receive-request";
import type { ExternalReceiveDestination, ReceiveDataPort, ReceiveRoute } from "./receive-types";

const route: ReceiveRoute = { action: "receive", receiveMode: "external-address", accountId: "demo-source",
  accountKind: "custodial", accountLabel: "Основной", assetId: "usdc", name: "USD Coin", symbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum" };
const destination: ExternalReceiveDestination = { accountId: route.accountId, assetId: route.assetId,
  networkId: route.networkId, mode: "external-address", safety: "demo-non-payable", reference: "DEMO-NON-PAYABLE:request-ethereum" };
const requestInput = { symbol: "USDC", networkLabel: "Ethereum", reference: destination.reference, rawAmount: "0012,3400" };
const requestText = `${RECEIVE_REQUEST_MARKER}\nАктив: USDC\nСеть: Ethereum\nЖелаемая сумма: 12.34 USDC\nРеквизиты:\n${destination.reference}`;
const writeText = vi.fn< (text: string) => Promise<void> >();
const share = vi.fn< (data: ShareData) => Promise<void> >();

function readyPort(): ReceiveDataPort {
  return { load: vi.fn(async () => ({ status: "ready" as const, data: destination })) };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  share.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText }, share });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  ["0012,3400", "12.34"], [" .5000 ", "0.5"], ["3.", "3"],
  ["000123456789012345678901234567890.000000000000000000019000", "123456789012345678901234567890.000000000000000000019"],
  [`0.${"0".repeat(124)}1`, `0.${"0".repeat(124)}1`],
])("normalizes exact decimal strings without float precision: %s", (raw, amount) => {
  expect(normalizeReceiveRequestAmount(raw)).toEqual({ status: "valid", amount });
});

it("allows blank requests and rejects zero, signs, exponent, invalid and oversized input", () => {
  expect(normalizeReceiveRequestAmount(" \t ")).toEqual({ status: "empty", amount: null });
  for (const raw of ["0", "00.000", ",0", "-2", "+2", "1e6", "1E-8", "1,2.3", ".", "2 500", "NaN", "Infinity", "abc"]) {
    expect(normalizeReceiveRequestAmount(raw).status).toBe("invalid");
  }
  expect(normalizeReceiveRequestAmount("1".repeat(129))).toEqual({ status: "invalid", reason: "too-long" });
  expect(normalizeReceiveRequestAmount("1".repeat(128))).toEqual({ status: "valid", amount: "1".repeat(128) });
});

it("builds one marked request, omits an absent amount and rejects invalid requests", () => {
  expect(buildReceiveRequestText(requestInput)).toBe(requestText);
  expect(buildReceiveRequestText({ ...requestInput, rawAmount: "" })).toBe(
    `${RECEIVE_REQUEST_MARKER}\nАктив: USDC\nСеть: Ethereum\nРеквизиты:\n${destination.reference}`);
  expect(buildReceiveRequestText({ ...requestInput, rawAmount: "1e8" })).toBeNull();
  expect(buildReceiveRequestText({ ...requestInput, reference: "not-demo" as ExternalReceiveDestination["reference"] })).toBeNull();
});

it("keeps a single compact preview and uses the same marked request for copy and share", async () => {
  const onRequestAmountChange = vi.fn();
  render(<ReceiveFlow route={route} dataPort={readyPort()} privacy={false} initialRequestAmount="0012,3400"
    onRequestAmountChange={onRequestAmountChange} onBack={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByRole("textbox", { name: "Желаемая сумма" })).toHaveValue("0012,3400");
  const preview = screen.getByRole("group", { name: "Предпросмотр запроса" });
  expect(preview).toHaveTextContent("12.34 USDC");
  expect(preview).toHaveTextContent("Ethereum");
  expect(screen.getAllByText(destination.reference)).toHaveLength(1);
  expect(screen.getByText("Не для оплаты")).toBeVisible();
  expect(onRequestAmountChange).not.toHaveBeenCalled();
  expect(writeText).not.toHaveBeenCalled(); expect(share).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Скопировать реквизиты" }));
  expect(writeText).toHaveBeenLastCalledWith(destination.reference);
  await screen.findByText("Демо-реквизиты скопированы.");
  fireEvent.click(screen.getByRole("button", { name: "Скопировать запрос" }));
  expect(writeText).toHaveBeenLastCalledWith(requestText);
  await screen.findByText("Запрос скопирован.");
  fireEvent.click(screen.getByRole("button", { name: "Поделиться запросом" }));
  expect(share).toHaveBeenCalledExactlyOnceWith({ title: "Демо · USDC · Ethereum", text: requestText });
  await screen.findByText("Действие «Поделиться» завершено.");
});

it("waits for browser copy success and blocks duplicate request actions while pending", async () => {
  const pending = deferred();
  writeText.mockImplementation(() => pending.promise);
  render(<ReceiveFlow route={route} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  const copy = await screen.findByRole("button", { name: "Скопировать запрос" });
  fireEvent.click(copy); fireEvent.click(copy);
  expect(writeText).toHaveBeenCalledOnce();
  expect(screen.queryByText("Запрос скопирован.")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Желаемая сумма" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Поделиться запросом" })).toBeDisabled();
  await act(async () => pending.resolve());
  expect(screen.getByRole("status")).toHaveTextContent("Запрос скопирован.");
});

it("keeps invalid raw edits for correction while disabling only request actions", async () => {
  const onRequestAmountChange = vi.fn();
  render(<ReceiveFlow route={route} dataPort={readyPort()} privacy={false}
    onRequestAmountChange={onRequestAmountChange} onBack={vi.fn()} onClose={vi.fn()} />);
  const input = await screen.findByRole("textbox", { name: "Желаемая сумма" });
  expect(input).toHaveAttribute("maxlength", "128");
  fireEvent.change(input, { target: { value: "0" } });
  expect(input).toHaveValue("0");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(onRequestAmountChange).toHaveBeenCalledExactlyOnceWith("0");
  expect(screen.getByRole("button", { name: "Скопировать запрос" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Поделиться запросом" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Скопировать реквизиты" })).toBeEnabled();
  expect(screen.queryByRole("group", { name: "Предпросмотр запроса" })).toBeNull();
});

it("redacts every private value and ignores pending feedback while preserving the raw draft above privacy", async () => {
  const pending = deferred();
  writeText.mockImplementation(() => pending.promise);
  const raw = "000987654321,123400000000000000000019";
  const onRequestAmountChange = vi.fn();
  const renderQr = vi.fn(() => <span>TEST RENDERER</span>);
  const props = { route, dataPort: readyPort(), onBack: vi.fn(), onClose: vi.fn(), onRequestAmountChange, renderQr };
  const { rerender, container } = render(<ReceiveFlow {...props} privacy={false} initialRequestAmount="7" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Желаемая сумма" }), { target: { value: raw } });
  expect(renderQr).toHaveBeenLastCalledWith({ value: destination.reference, testOnly: true,
    accountId: route.accountId, assetId: route.assetId, networkId: route.networkId });
  fireEvent.click(screen.getByRole("button", { name: "Скопировать запрос" }));
  renderQr.mockClear();
  rerender(<ReceiveFlow {...props} privacy initialRequestAmount="999" />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("group", { name: "Предпросмотр запроса" })).toBeNull();
  expect(container.innerHTML).not.toContain("987654321");
  expect(container.innerHTML).not.toContain(destination.reference);
  expect(renderQr).not.toHaveBeenCalled();
  for (const name of ["Скопировать реквизиты", "Скопировать запрос", "Поделиться запросом"]) {
    expect(screen.getByRole("button", { name })).toBeDisabled();
  }
  await act(async () => pending.resolve());
  expect(screen.queryByText("Запрос скопирован.")).toBeNull();
  rerender(<ReceiveFlow {...props} privacy={false} initialRequestAmount="999" />);
  expect(screen.getByRole("textbox", { name: "Желаемая сумма" })).toHaveValue(raw);
  expect(onRequestAmountChange).toHaveBeenCalledExactlyOnceWith(raw);
});

it("keeps draft through a hidden detail roundtrip and seeds it once after a host remount", async () => {
  const dataPort = readyPort(), onRequestAmountChange = vi.fn();
  const props = { route, dataPort, privacy: false, onBack: vi.fn(), onClose: vi.fn(), onRequestAmountChange };
  const { rerender, unmount } = render(<div><ReceiveFlow {...props} /></div>);
  fireEvent.change(await screen.findByRole("textbox", { name: "Желаемая сумма" }), { target: { value: "003,500" } });
  rerender(<div hidden><ReceiveFlow {...props} /></div>);
  rerender(<div><ReceiveFlow {...props} /></div>);
  expect(screen.getByRole("textbox", { name: "Желаемая сумма" })).toHaveValue("003,500");
  expect(dataPort.load).toHaveBeenCalledOnce();
  unmount();
  render(<ReceiveFlow {...props} initialRequestAmount="003,500" />);
  expect(await screen.findByRole("textbox", { name: "Желаемая сумма" })).toHaveValue("003,500");
  expect(onRequestAmountChange).toHaveBeenCalledExactlyOnceWith("003,500");
});

it("starts a new route with its own draft and ignores completion of the previous request copy", async () => {
  const pending = deferred();
  writeText.mockImplementation(() => pending.promise);
  const dataPort: ReceiveDataPort = { load: vi.fn<ReceiveDataPort["load"]>(async request => ({ status: "ready", data: {
    ...destination, networkId: request.networkId, reference: `DEMO-NON-PAYABLE:request-${request.networkId}`,
  } })) };
  const props = { dataPort, privacy: false, onBack: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<ReceiveFlow {...props} route={route} initialRequestAmount="19,87" />);
  fireEvent.click(await screen.findByRole("button", { name: "Скопировать запрос" }));
  rerender(<ReceiveFlow {...props} route={{ ...route, networkId: "solana", networkLabel: "Solana" }} />);
  expect(await screen.findByRole("textbox", { name: "Желаемая сумма" })).toHaveValue("");
  expect(screen.getByRole("group", { name: "Предпросмотр запроса" })).toHaveTextContent("Solana");
  expect(screen.queryByText(/Желаемая сумма: 19.87/)).toBeNull();
  await act(async () => pending.resolve());
  expect(screen.queryByText("Запрос скопирован.")).toBeNull();
});

it("treats share cancellation as neutral and never reports success after a browser rejection", async () => {
  share.mockRejectedValueOnce(new DOMException("cancel", "AbortError"));
  writeText.mockRejectedValueOnce(new Error("denied"));
  render(<ReceiveFlow route={route} dataPort={readyPort()} privacy={false} onBack={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Поделиться запросом" }));
  await screen.findByText("Меню «Поделиться» закрыто.");
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Скопировать запрос" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скопировать запрос");
  expect(screen.queryByText("Запрос скопирован.")).toBeNull();
});
