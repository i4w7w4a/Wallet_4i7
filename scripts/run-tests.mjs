import { spawnSync } from "node:child_process";

// React's act API and Vitest's Node imports require the test environment.
const result = spawnSync("pnpm -r test", {
  env: { ...process.env, NODE_ENV: "test" },
  shell: true,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
}

process.exitCode = result.status ?? 1;
