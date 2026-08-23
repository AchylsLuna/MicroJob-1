import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enWorker from '../locales/en/worker.json';
import enEmployer from '../locales/en/employer.json';
import filCommon from '../locales/fil/common.json';
import filAuth from '../locales/fil/auth.json';
import filWorker from '../locales/fil/worker.json';
import filEmployer from '../locales/fil/employer.json';

export const defaultNS = 'common';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, auth: enAuth, worker: enWorker, employer: enEmployer },
    fil: { common: filCommon, auth: filAuth, worker: filWorker, employer: filEmployer },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'auth', 'worker', 'employer'],
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
