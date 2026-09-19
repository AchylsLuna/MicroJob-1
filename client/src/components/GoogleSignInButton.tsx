import { useEffect, useRef, useState } from "react";

type GoogleCredentialHandler = (credential: string) => void;

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
    __microJobsGoogleClientId?: string;
    __microJobsGoogleCredentialHandler?: GoogleCredentialHandler | null;
  }
}

type Props = {
  onCredential: (credential: string) => void;
  disabled?: boolean;
};

const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const GSI_SCRIPT_ID = "microjobs-google-identity-services";

let gsiLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityServices() {
  if (window.google) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript || document.createElement("script");

    const onLoad = () => window.google ? resolve() : reject(new Error("Google Identity Services did not load."));
    const onError = () => reject(new Error("Google Identity Services could not be loaded."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existingScript) {
      script.id = GSI_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return gsiLoadPromise;
}

export function GoogleSignInButton({ onCredential, disabled = false }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const [unavailable, setUnavailable] = useState(!clientId);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !buttonRef.current || disabled) return;
    let mounted = true;
    const handler: GoogleCredentialHandler = (credential) => onCredentialRef.current(credential);
    window.__microJobsGoogleCredentialHandler = handler;

    const render = () => {
      if (!mounted || !window.google || !buttonRef.current) return;
      // GSI is global. Re-initializing it on React renders or route changes
      // causes Google's warning and makes the last callback win. Initialize
      // once, then update the callback reference and render this instance.
      if (window.__microJobsGoogleClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => window.__microJobsGoogleCredentialHandler?.(response.credential),
        });
        window.__microJobsGoogleClientId = clientId;
      }
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 400, text: "continue_with" });
      setUnavailable(false);
    };

    void loadGoogleIdentityServices().then(render).catch(() => {
      if (mounted) setUnavailable(true);
    });

    return () => {
      mounted = false;
      if (window.__microJobsGoogleCredentialHandler === handler) {
        window.__microJobsGoogleCredentialHandler = null;
      }
    };
  }, [disabled]);

  if (unavailable) return null;
  return <div ref={buttonRef} className="flex min-h-11 justify-center" aria-label="Continue with Google" />;
}
