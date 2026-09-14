const apiPort = String(Number(process.argv[2]) || 5055);
const clientPort = String(Number(process.argv[3]) || 8082);

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "",
  MONGODB_URI: "",
  ENABLE_IN_MEMORY_MONGO: "true",
  AUTO_SEED_DEMO_USER: "true",
  DEMO_USER_EMAIL: "e2e-user@microjobs.local",
  DEMO_USER_PASSWORD: "ReviewPass123!",
  DEMO_USER_ROLE: "both",
  AUTO_SEED_SUPERADMIN: "true",
  SUPERADMIN_EMAIL: "e2e-admin@microjobs.local",
  SUPERADMIN_PASSWORD: "AdminPass123!",
  PORT: apiPort,
  WEB_ORIGIN: `http://127.0.0.1:${clientPort}`,
  // Blank out any real email provider config a root/server .env might supply --
  // otherwise dotenv fills these from the developer's real credentials (it
  // only sets vars that aren't already present) and this "isolated" sandbox
  // would silently send real emails and never hit the dev/test OTP fallback
  // the e2e login flow depends on. Same isolation principle as MONGO_URI above.
  RESEND_API_KEY: "",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USER: "",
  SMTP_PASS: "",
});

import("../server/index.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
