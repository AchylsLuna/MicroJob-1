const { spawn } = require("node:child_process");

// Port 5000 is commonly occupied by macOS Control Center/AirPlay Receiver.
// Keep the combined local launcher on a conflict-free default while still
// allowing an explicit DEV_API_PORT or PORT override.
const apiPort = String(process.env.DEV_API_PORT || process.env.PORT || "5050");
const clientPort = String(process.env.DEV_CLIENT_PORT || "5173");
const clientOrigin = `http://localhost:${clientPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const shouldOpenAdmin = !["1", "true", "yes"].includes(
  String(process.env.NO_OPEN || "").toLowerCase(),
);

const sharedEnvironment = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: apiPort,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || clientOrigin,
  VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET || apiOrigin,
  AUTO_SEED_SUPERADMIN: process.env.AUTO_SEED_SUPERADMIN || "true",
  // Keep the documented local-only admin credentials deterministic. Production
  // never runs this launcher, and callers can explicitly override this behavior.
  SUPERADMIN_RESET_PASSWORD: process.env.SUPERADMIN_RESET_PASSWORD || "true",
};

const processes = [];
let shuttingDown = false;

const start = (label, args) => {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: sharedEnvironment,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });

  processes.push(child);
  child.on("error", (error) => {
    console.error(`[${label}] Failed to start: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`[${label}] Exited with ${reason}. Stopping the development environment.`);
    shutdown(code || 1);
  });
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (child.killed || !child.pid) continue;
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") console.error(`Failed to stop process ${child.pid}: ${error.message}`);
    }
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Starting MicroJobs API at ${apiOrigin}`);
console.log(`Starting MicroJobs web app at ${clientOrigin}`);
console.log(`Development admin sign-in: ${clientOrigin}/admin-sign-in`);
console.log("Development superadmin is created automatically when it does not exist.");

start("api", ["scripts/run-with-node.cjs", "nodemon", "server/index.js"]);

const clientArguments = [
  "scripts/run-with-node.cjs",
  "vite",
  "--config",
  "client/vite.config.ts",
  "--port",
  clientPort,
];
if (shouldOpenAdmin) clientArguments.push("--open", "/admin-sign-in");
start("web", clientArguments);
