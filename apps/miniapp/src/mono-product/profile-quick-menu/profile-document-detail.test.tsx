import "@testing-library/jest-dom/vitest";
import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProfileQuickMenu } from "./profile-quick-menu";

afterEach(cleanup);

function DocumentsHost({ unrelatedMarker = false }: { unrelatedMarker?: boolean }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  return <main>
    <div data-profile-panel={unrelatedMarker || undefined}><button ref={anchorRef} onClick={() => setOpen(true)}>Документы</button></div>
    <ProfileQuickMenu id="documents-menu" inline open={open} anchorRef={anchorRef} initialDetail="documents"
      theme="dark" balanceHidden={false} onBalanceHiddenChange={() => {}} onDismiss={() => { setOpen(false); anchorRef.current?.focus(); }} />
  </main>;
}

// Catches the Menu's document-capture listener swallowing the local detail's Escape.
it("returns from a nested document on the first Escape and closes the direct Menu detail on the next", () => {
  render(<DocumentsHost />);
  const row = screen.getByRole("button", { name: "Условия использования" }); fireEvent.click(row);
  fireEvent.keyDown(screen.getByRole("button", { name: "Назад к документам" }), { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Документы сервиса" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Условия использования" })).toBeNull();
  expect(row).toHaveFocus();
  fireEvent.keyDown(row, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Документы" })).toHaveFocus();
});

// Catches a global marker guard exempting unrelated launchers from ordinary Escape handling.
it("does not exempt an unrelated profile-panel marker outside its own Menu", () => {
  render(<DocumentsHost unrelatedMarker />);
  const anchor = screen.getByRole("button", { name: "Документы" });
  anchor.focus(); fireEvent.keyDown(anchor, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(anchor).toHaveFocus();
});
