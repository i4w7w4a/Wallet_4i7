import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoShareButton } from "./mono-share-button";

afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, "clipboard"); });

const url = "https://wallet.example/mono/view#mono=snapshot";

it("opens the complete viewer from one compact action without a popup or permanent form", async () => {
  const openLink = vi.fn();
  render(<MonoShareButton sourceKey="A:1" createLink={async () => url} openLink={openLink} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Открыть кошелёк" }));
  await waitFor(() => expect(openLink).toHaveBeenCalledExactlyOnceWith(url));
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("copies a resolved link and offers selectable text if clipboard access fails", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(<MonoShareButton sourceKey="A:1" createLink={async () => url} />);
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  expect(await screen.findByRole("textbox", { name: "Ссылка на кошелёк" })).toHaveValue(url);
  expect(await screen.findByRole("status")).toHaveTextContent(/выделите ссылку/i);
});

it("invalidates a prior accepted snapshot and reports bounded generation errors", async () => {
  const { rerender } = render(<MonoShareButton sourceKey="A:1" createLink={async () => url} />);
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  await screen.findByRole("textbox");
  rerender(<MonoShareButton sourceKey="A:2" createLink={async () => {
    throw new Error("Оформление слишком велико для ссылки. Сохраните полный JSON.");
  }} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Открыть кошелёк" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/полный JSON/);
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("disables both actions while accepted data is unavailable", () => {
  render(<MonoShareButton sourceKey="A:1" disabled createLink={async () => url} />);
  expect(screen.getByRole("button", { name: "Открыть кошелёк" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Скопировать ссылку" })).toBeDisabled();
});

it("labels a loopback preview honestly instead of promising access from another phone", async () => {
  render(<MonoShareButton sourceKey="A:1" createLink={async () => "http://127.0.0.1:3126/mono/view#mono=snapshot"} />);
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  expect(await screen.findByText("Локальная ссылка · на этом компьютере")).toBeVisible();
});

it("does not navigate from a late result after its accepted source changed", async () => {
  let finish!: (link: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  const openLink = vi.fn();
  const { rerender } = render(<MonoShareButton sourceKey="A:1" createLink={() => pending} openLink={openLink} />);
  fireEvent.click(screen.getByRole("button", { name: "Открыть кошелёк" }));
  rerender(<MonoShareButton sourceKey="B:1" createLink={async () => "https://wallet.example/mono/view#mono=new"}
    openLink={openLink} />);
  await act(async () => { finish(url); await pending; });
  expect(openLink).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Открыть кошелёк" })).toBeEnabled();
});

it("warns for a long, valid link and preserves the manual copy fallback", async () => {
  const long = "https://wallet.example/mono/view#mono=" + "a".repeat(4100);
  render(<MonoShareButton sourceKey="A:1" createLink={async () => long} />);
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  expect(await screen.findByText(/мессенджер может её обрезать/)).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue(long);
  expect(screen.queryByRole("alert")).toBeNull();
});
