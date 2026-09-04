import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void;
        };
      };
    };
  }
}

type Props = {
  onCredential: (credential: string) => void;
  disabled?: boolean;
};

const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

export function GoogleSignInButton({ onCredential, disabled = false }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(!clientId);

  useEffect(() => {
    if (!clientId || !buttonRef.current || disabled) return;
    const render = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => onCredential(response.credential) });
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 400, text: "continue_with" });
      setUnavailable(false);
    };
    if (window.google) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setUnavailable(true);
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [disabled, onCredential]);

  if (unavailable) return null;
  return <div ref={buttonRef} className="flex min-h-11 justify-center" aria-label="Continue with Google" />;
}
