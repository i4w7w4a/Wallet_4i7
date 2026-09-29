"use client";

export default function PublishedMonoError({ reset }: { error: Error; reset: () => void }) {
  return <main role="alert" style={{ minHeight: "100dvh", display: "grid", placeContent: "center",
    padding: 24, background: "#111216", color: "#f0f1f3", font: "16px/1.5 Arial,sans-serif" }}>
    <h1>Кошелёк временно недоступен</h1>
    <button type="button" onClick={reset} style={{ minHeight: 44, padding: "8px 16px" }}>Повторить</button>
  </main>;
}
