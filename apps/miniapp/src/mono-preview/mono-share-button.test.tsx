import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MonoShareButton } from "./mono-share-button";

afterEach(cleanup);

it("keeps the generated immutable link available for manual copy", async () => {
  render(<MonoShareButton sourceKey="A:1" createLink={async () => "https://wallet.example/mono/view#mono=snapshot"} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  expect(await screen.findByRole("textbox", { name: "Ссылка на оформление" })).toHaveValue("https://wallet.example/mono/view#mono=snapshot");
  expect(screen.getByRole("link", { name: "Открыть готовый вид" })).toHaveAttribute("href", "https://wallet.example/mono/view#mono=snapshot");
});

it("shows a generation failure without leaving a stale link presented as the new result", async () => {
  const { rerender } = render(<MonoShareButton sourceKey="A:1" createLink={async () => "https://wallet.example/mono/view#mono=old"} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  await screen.findByRole("textbox");
  rerender(<MonoShareButton sourceKey="A:1" createLink={async () => { throw new Error("Оформление слишком велико для ссылки."); }} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Оформление слишком велико для ссылки.");
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("allows the editor to disable sharing while accepted data is unavailable", () => {
  render(<MonoShareButton sourceKey="A:1" disabled createLink={async () => "https://wallet.example/mono/view"} />);
  expect(screen.getByRole("button", { name: "Получить ссылку" })).toBeDisabled();
});

it("labels a loopback preview honestly instead of promising access from another phone", async () => {
  render(<MonoShareButton sourceKey="A:1" createLink={async () => "http://127.0.0.1:3126/mono/view#mono=snapshot"} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  expect(await screen.findByText("Локальная ссылка · на этом компьютере")).toBeVisible();
});

it.each(["A:2", "B:1"])("removes stale copy controls when the accepted source becomes %s", async nextKey => {
  const createLink = async () => "https://wallet.example/mono/view#mono=old";
  const { rerender } = render(<MonoShareButton sourceKey="A:1" createLink={createLink} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  await screen.findByRole("textbox");
  rerender(<MonoShareButton sourceKey={nextKey} createLink={createLink} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Скопировать" })).toBeNull();
});

it("cannot display a late result from the previous accepted source", async () => {
  let finish!: (link: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  const { rerender } = render(<MonoShareButton sourceKey="A:1" createLink={() => pending} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  rerender(<MonoShareButton sourceKey="B:1" createLink={async () => "https://wallet.example/mono/view#mono=new"} />);
  await act(async () => { finish("https://wallet.example/mono/view#mono=old"); await pending; });
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: "Получить ссылку" })).toBeEnabled();
});
