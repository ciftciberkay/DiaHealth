import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, "..");
const port = Number(process.env.PORT ?? "3001");
const checkOnly = process.argv.includes("--check");

const run = (command, args) => execFileSync(command, args, { encoding: "utf8" }).trim();

const getListenerPid = () => {
  try {
    const output = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return output.split("\n").map((value) => value.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
};

const getCommand = (pid) => {
  try {
    return run("ps", ["-p", pid, "-o", "command="]);
  } catch {
    return "";
  }
};

const getCwd = (pid) => {
  try {
    const output = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]);
    return output
      .split("\n")
      .map((value) => value.trim())
      .find((value) => value.startsWith("n"))
      ?.slice(1) ?? "";
  } catch {
    return "";
  }
};

const isDiahealthApiProcess = (command, cwd) =>
  cwd === apiDir ||
  command.includes("/diahealth/apps/api") ||
  command.includes("tsx watch src/main.ts") ||
  command.includes("node ./scripts/dev.mjs");

const clearPortIfSafe = () => {
  const pid = getListenerPid();

  if (!pid) {
    return;
  }

  const command = getCommand(pid);
  const cwd = getCwd(pid);

  if (!isDiahealthApiProcess(command, cwd)) {
    console.error(`Port ${port} başka süreçte kullanılıyor.`);
    console.error(command || `PID ${pid}`);
    process.exit(1);
  }

  process.kill(Number(pid), "SIGTERM");
  console.log(`Port ${port} temizlendi. PID ${pid}`);
};

clearPortIfSafe();

if (checkOnly) {
  process.exit(0);
}

const child = spawn("tsx", ["watch", "src/main.ts"], {
  cwd: apiDir,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    child.kill(signal);
  });
});
