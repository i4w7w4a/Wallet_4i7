"use client";
import type { ReactNode } from "react";
import type { MonoAppearance } from "./mono-preset-envelope";

export type MonoViewerProps = { renderScene: (appearance: MonoAppearance) => ReactNode };
export function MonoViewer(_props: MonoViewerProps) { return <div>Загрузка оформления…</div>; }
