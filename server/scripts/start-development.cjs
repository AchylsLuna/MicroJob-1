process.env.NODE_ENV = "development";
process.env.WEB_ORIGIN ||= "http://localhost:5173";
process.env.PHONE_OTP_PROVIDER = "development";
process.env.PHONE_OTP_DEFAULT_COUNTRY_CODE = "+63";
process.env.PHONE_OTP_EXPOSE_CODE = "true";

import("../index.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
