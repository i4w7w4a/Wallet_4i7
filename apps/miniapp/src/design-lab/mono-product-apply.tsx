"use client";

import { useState } from "react";
import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";
import type { BackgroundLabDocumentV1 } from "./background-sandbox/document-v3";
import type { ButtonLabDocument, ButtonLabWorkspace } from "./button-workshop/model";

type Shared = { disabled?: boolean; onDialogChange?: (open: boolean) => void };
export type MonoProductApplyProps = Shared & (
  | { scope: "background"; document: BackgroundLabDocumentV1 }
  | { scope: "buttons"; document: ButtonLabDocument<ButtonTargetId, MaterialTargetBinding>;
      selection: ButtonLabWorkspace<ButtonTargetId, MaterialTargetBinding>["selection"] }
);

/** Explicit product transfer, separate from a workshop's own accepted preview. */
export function MonoProductApply(props: MonoProductApplyProps) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => { setOpen(next); props.onDialogChange?.(next); };
  return <>
    <button type="button" disabled={props.disabled} onClick={() => changeOpen(true)}>В рабочий пресет MONO…</button>
    {open && <dialog open aria-label="Применить материал в MONO">
      <p>Подготовка переноса в рабочий пресет MONO…</p>
      <button type="button" onClick={() => changeOpen(false)}>Закрыть</button>
    </dialog>}
  </>;
}
