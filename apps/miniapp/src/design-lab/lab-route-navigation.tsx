import { LabNavigation, type LabId } from "./lab-navigation";

const PUBLIC_LABS: readonly LabId[] = ["home", "atmosphere", "buttons", "motion"];
const DEVELOPMENT_LABS: readonly LabId[] = [...PUBLIC_LABS, "type", "scene"];

export function enabledLabIds(): readonly LabId[] {
  return process.env.NODE_ENV === "development" ? DEVELOPMENT_LABS : PUBLIC_LABS;
}

export function LabRouteNavigation({ active }: { active: LabId }) {
  return <div style={{ background: "#151718", padding: "12px max(12px, env(safe-area-inset-right)) 0" }}>
    <div style={{ maxWidth: 1680, margin: "0 auto" }}>
      <LabNavigation active={active} enabled={enabledLabIds()} />
    </div>
  </div>;
}
