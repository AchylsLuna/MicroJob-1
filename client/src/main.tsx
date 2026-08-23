import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { NotificationProvider } from "./contexts/NotificationContext";
import { LanguageProvider } from "./hooks/useLanguage";
import "./i18n";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
    <Analytics />
  </React.StrictMode>,
);
