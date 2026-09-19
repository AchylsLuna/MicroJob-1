process.env.NODE_ENV = "development";
// Keep standalone `npm run dev:server` aligned with the web/mobile launchers.
// Port 5000 is commonly occupied by macOS Control Center/AirPlay.
process.env.PORT ||= process.env.DEV_API_PORT || "5050";
process.env.WEB_ORIGIN ||= "http://localhost:8082";

import("../index.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
