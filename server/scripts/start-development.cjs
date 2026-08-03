process.env.NODE_ENV = "development";
process.env.WEB_ORIGIN ||= "http://localhost:5173";

import("../index.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
