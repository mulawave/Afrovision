declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

let recaptchaLoadPromise: Promise<void> | null = null;

function loadEnterpriseScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.grecaptcha?.enterprise) {
    return Promise.resolve();
  }

  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }

  recaptchaLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-recaptcha-enterprise='1']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA Enterprise script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaEnterprise = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA Enterprise script"));
    document.head.appendChild(script);
  });

  return recaptchaLoadPromise;
}

export async function executeRecaptchaEnterprise(siteKey: string, action: string): Promise<string> {
  if (!siteKey) return "";

  await loadEnterpriseScript(siteKey);

  if (!window.grecaptcha?.enterprise) {
    throw new Error("reCAPTCHA Enterprise is unavailable");
  }

  return new Promise((resolve, reject) => {
    window.grecaptcha?.enterprise?.ready(async () => {
      try {
        const token = await window.grecaptcha!.enterprise!.execute(siteKey, { action });
        resolve(token || "");
      } catch (error) {
        reject(error);
      }
    });
  });
}
