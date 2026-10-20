import React from "react";
import ReactDOM from "react-dom/client";
import { ConsentGatedAnalytics } from "./components/ConsentGatedAnalytics";
// Self-hosted, and imported before index.css so the @font-face rules are in
// place when `--app-font-family` resolves. That variable has named Inter all
// along, but nothing ever loaded it -- no font link, no @font-face -- so the
// app silently rendered in Segoe UI / Helvetica Neue. The type scale was
// designed against Inter's metrics, which is why so many sizes are odd values
// like 13px.
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { NotificationProvider } from "./contexts/NotificationContext";
import { MessagingProvider } from "./contexts/MessagingContext";
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
          <MessagingProvider>
            <App />
          </MessagingProvider>
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
    <ConsentGatedAnalytics />
  </React.StrictMode>,
);
