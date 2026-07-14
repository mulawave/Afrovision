"use client";

import { useEffect, useState } from "react";
import { getAppLinkConfig, type AppLinkConfig } from "@/lib/homepage";

const DISMISS_KEY = "afrovision_android_banner_dismissed";
const OPEN_APP_DISMISS_KEY = "afrovision_android_open_app_dismissed";

export function AndroidAppBanner() {
  const [config, setConfig] = useState<AppLinkConfig | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showDownloadBanner, setShowDownloadBanner] = useState(false);
  const [showOpenAppBanner, setShowOpenAppBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    const android = /Android/i.test(ua);
    if (!android) return;

    setIsAndroid(true);

    getAppLinkConfig()
      .then((cfg) => {
        setConfig(cfg);

        const androidUrl = cfg?.android?.play_store_url || "";
        const androidEnabled = cfg?.android?.enabled && androidUrl.length > 0;
        const packageName = cfg?.android?.package_name || "com.afrovision.afrovision";

        // Check if the app is already installed by attempting to open the app intent
        // We use a hidden iframe approach to detect if the app is installed
        const openAppDismissed = sessionStorage.getItem(OPEN_APP_DISMISS_KEY) === "1";
        const downloadDismissed = localStorage.getItem(DISMISS_KEY) === "1";

        if (!openAppDismissed) {
          // Try to detect if app is installed by checking if the intent URL works
          // We'll attempt to open the app and use a timeout to detect failure
          const intentUrl = `intent://#Intent;package=${packageName};scheme=afrovision;end`;

          // Use a hidden iframe to test the intent without navigating away
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = intentUrl;

          let appDetected = false;

          const cleanup = () => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          };

          const visibilityHandler = () => {
            if (document.hidden) {
              appDetected = true;
              cleanup();
              document.removeEventListener("visibilitychange", visibilityHandler);
              setShowOpenAppBanner(true);
            }
          };

          document.addEventListener("visibilitychange", visibilityHandler);

          // Set the iframe src to trigger the intent
          document.body.appendChild(iframe);

          // After a short delay, if the page is still visible, the app is not installed
          setTimeout(() => {
            cleanup();
            document.removeEventListener("visibilitychange", visibilityHandler);

            if (!appDetected) {
              if (androidEnabled && !downloadDismissed) {
                setShowDownloadBanner(true);
              }
            } else {
              if (!openAppDismissed) {
                setShowOpenAppBanner(true);
              }
            }
          }, 500);
        } else if (androidEnabled && !downloadDismissed) {
          setShowDownloadBanner(true);
        }
      })
      .catch(() => {});
  }, []);

  const dismissDownloadBanner = () => {
    setShowDownloadBanner(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const dismissOpenAppBanner = () => {
    setShowOpenAppBanner(false);
    sessionStorage.setItem(OPEN_APP_DISMISS_KEY, "1");
  };

  if (!isAndroid) return null;

  const androidUrl = config?.android?.play_store_url || "";
  const packageName = config?.android?.package_name || "com.afrovision.afrovision";
  const openAppUrl = `intent://#Intent;package=${packageName};scheme=afrovision;end`;

  // Download banner — shown when app is not installed
  if (showDownloadBanner && androidUrl) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="mx-auto max-w-2xl rounded-2xl border border-av-orange/30 bg-av-card/95 backdrop-blur-md shadow-2xl shadow-black/50 px-4 py-3 flex items-center gap-3 animate-fade-in-up">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-av-dark-blue">
              <path d="M17.523 15.341c-.583 0-1.057-.473-1.057-1.057 0-.583.474-1.057 1.057-1.057.584 0 1.057.474 1.057 1.057 0 .584-.473 1.057-1.057 1.057m-11.046 0c-.583 0-1.057-.473-1.057-1.057 0-.583.474-1.057 1.057-1.057.584 0 1.057.474 1.057 1.057 0 .584-.473 1.057-1.057 1.057m11.42-5.802l2.103-3.643a.35.35 0 00-.128-.478.35.35 0 00-.478.128l-2.13 3.691c-1.595-.729-3.39-1.139-5.289-1.139s-3.694.41-5.289 1.14L4.566 5.546a.35.35 0 00-.478-.128.35.35 0 00-.128.478l2.103 3.643C2.153 11.537.193 14.691 0 18.357h24c-.193-3.666-2.153-6.82-5.103-8.818" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-av-white">Download the ADTv Go app</p>
            <p className="text-[11px] text-av-light-orange">Get it from the Play Store for a better experience</p>
          </div>
          <a
            href={androidUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-xs font-bold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            Download
          </a>
          <button
            onClick={dismissDownloadBanner}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-av-light-orange hover:text-av-white hover:bg-av-white/5 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Open app banner — shown when app is installed
  if (showOpenAppBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="mx-auto max-w-2xl rounded-2xl border border-av-orange/30 bg-av-card/95 backdrop-blur-md shadow-2xl shadow-black/50 px-4 py-3 flex items-center gap-3 animate-fade-in-up">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-av-dark-blue">
              <path d="M17.523 15.341c-.583 0-1.057-.473-1.057-1.057 0-.583.474-1.057 1.057-1.057.584 0 1.057.474 1.057 1.057 0 .584-.473 1.057-1.057 1.057m-11.046 0c-.583 0-1.057-.473-1.057-1.057 0-.583.474-1.057 1.057-1.057.584 0 1.057.474 1.057 1.057 0 .584-.473 1.057-1.057 1.057m11.42-5.802l2.103-3.643a.35.35 0 00-.128-.478.35.35 0 00-.478.128l-2.13 3.691c-1.595-.729-3.39-1.139-5.289-1.139s-3.694.41-5.289 1.14L4.566 5.546a.35.35 0 00-.478-.128.35.35 0 00-.128.478l2.103 3.643C2.153 11.537.193 14.691 0 18.357h24c-.193-3.666-2.153-6.82-5.103-8.818" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-av-white">Open ADTv Go</p>
            <p className="text-[11px] text-av-light-orange">For a better experience, open the app</p>
          </div>
          <a
            href={openAppUrl}
            className="shrink-0 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-xs font-bold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            Open App
          </a>
          <button
            onClick={dismissOpenAppBanner}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-av-light-orange hover:text-av-white hover:bg-av-white/5 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
