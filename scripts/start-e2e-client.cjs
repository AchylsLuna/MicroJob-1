const clientPort = String(Number(process.argv[2]) || 5173);
const apiPort = String(Number(process.argv[3]) || 5055);
const { spawn } = require("node:child_process");
const path = require("node:path");

process.env.VITE_API_PROXY_TARGET = `http://127.0.0.1:${apiPort}`;
const workspaceRoot = path.resolve(__dirname, "..");
const child = spawn(process.execPath, [
  path.join(__dirname, "run-with-node.cjs"),
  "node",
  "node_modules/vite/bin/vite.js",
  "--config",
  "client/vite.config.ts",
  "--host",
  "127.0.0.1",
  "--port",
  clientPort,
], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
