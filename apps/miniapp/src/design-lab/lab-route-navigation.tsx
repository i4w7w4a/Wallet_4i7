import { LabNavigation, type LabId } from "./lab-navigation";

const PUBLIC_LABS: readonly LabId[] = ["home", "atmosphere", "buttons"];
const REVIEW_LABS: readonly LabId[] = [...PUBLIC_LABS, "motion"];
const DEVELOPMENT_LABS: readonly LabId[] = [...REVIEW_LABS, "type", "scene"];

export function enabledLabIds(): readonly LabId[] {
  return process.env.NODE_ENV === "development" ? DEVELOPMENT_LABS
    : process.env.NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB === "1" ? REVIEW_LABS : PUBLIC_LABS;
}

export function LabRouteNavigation({ active }: { active: LabId }) {
  return <div data-mono-selection-surface style={{ background: "#151718", padding: "12px max(12px, env(safe-area-inset-right)) 0" }}>
    <div style={{ maxWidth: 1680, margin: "0 auto" }}>
      <LabNavigation active={active} enabled={enabledLabIds()} />
    </div>
  </div>;
}
