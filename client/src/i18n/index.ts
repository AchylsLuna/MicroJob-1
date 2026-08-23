import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enWorker from "../locales/en/worker.json";
import enEmployer from "../locales/en/employer.json";
import enAdmin from "../locales/en/admin.json";
import tlCommon from "../locales/tl/common.json";
import tlAuth from "../locales/tl/auth.json";
import tlWorker from "../locales/tl/worker.json";
import tlEmployer from "../locales/tl/employer.json";
import tlAdmin from "../locales/tl/admin.json";

export const defaultNS = "common";

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, auth: enAuth, worker: enWorker, employer: enEmployer, admin: enAdmin },
    tl: { common: tlCommon, auth: tlAuth, worker: tlWorker, employer: tlEmployer, admin: tlAdmin },
  },
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "auth", "worker", "employer", "admin"],
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
