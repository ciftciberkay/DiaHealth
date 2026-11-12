import { spawnSync } from "node:child_process";

const runs = [
  ["expo", ["export", "--platform", "ios", "--output-dir", "dist/ios"]],
  ["expo", ["export", "--platform", "android", "--output-dir", "dist/android"]]
];

for (const [command, args] of runs) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
