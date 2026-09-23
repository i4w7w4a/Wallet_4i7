import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MonoShareButton } from "./mono-share-button";

afterEach(cleanup);

it("keeps the generated immutable link available for manual copy", async () => {
  render(<MonoShareButton createLink={async () => "https://wallet.example/mono/view#mono=snapshot"} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  expect(await screen.findByRole("textbox", { name: "Ссылка на оформление" })).toHaveValue("https://wallet.example/mono/view#mono=snapshot");
  expect(screen.getByRole("link", { name: "Открыть готовый вид" })).toHaveAttribute("href", "https://wallet.example/mono/view#mono=snapshot");
});

it("shows a generation failure without leaving a stale link presented as the new result", async () => {
  const { rerender } = render(<MonoShareButton createLink={async () => "https://wallet.example/mono/view#mono=old"} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  await screen.findByRole("textbox");
  rerender(<MonoShareButton createLink={async () => { throw new Error("Оформление слишком велико для ссылки."); }} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Оформление слишком велико для ссылки.");
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("allows the editor to disable sharing while accepted data is unavailable", () => {
  render(<MonoShareButton disabled createLink={async () => "https://wallet.example/mono/view"} />);
  expect(screen.getByRole("button", { name: "Получить ссылку" })).toBeDisabled();
});
