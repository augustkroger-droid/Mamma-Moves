"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_STORAGE_KEY = "mamma-moves-pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in window.navigator && window.navigator.standalone === true)
  );
}

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isAndroidDevice() {
  return /android/.test(window.navigator.userAgent.toLowerCase());
}

function isRecentlyDismissed() {
  const dismissedAt = window.localStorage.getItem(DISMISS_STORAGE_KEY);

  if (!dismissedAt) {
    return false;
  }

  const dismissedTime = Number(dismissedAt);
  const dismissWindow = DISMISS_DAYS * 24 * 60 * 60 * 1000;
  return Number.isFinite(dismissedTime) && Date.now() - dismissedTime < dismissWindow;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const isAndroid = platform === "android";
  const title = isAndroid ? "Installera Mamma Moves" : "Lägg Mamma Moves på hemskärmen";
  const lead = isAndroid
    ? "Spara appen på mobilen för snabb åtkomst och en mer app-lik känsla."
    : "På iPhone och iPad installeras appen via delningsmenyn i webbläsaren.";

  const iosSteps = useMemo(() => [
    { icon: Share, text: "Tryck på dela-knappen i webbläsaren." },
    { icon: Plus, text: "Välj Lägg till på hemskärmen." },
    { icon: Download, text: "Bekräfta så hamnar appen bland dina appar." }
  ], []);

  useEffect(() => {
    if (isStandalone() || isRecentlyDismissed()) {
      return;
    }

    const ios = isIosDevice();
    const android = isAndroidDevice();

    if (ios) {
      const timeout = window.setTimeout(() => {
        setPlatform("ios");
        setIsVisible(true);
      }, 1400);

      return () => window.clearTimeout(timeout);
    }

    if (!android) {
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setPlatform("android");
      setIsVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismissPrompt() {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setIsVisible(false);
  }

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setIsInstalling(false);
    setIsVisible(false);
  }

  if (!isVisible || !platform) {
    return null;
  }

  return (
    <div className="pwa-install-backdrop" role="presentation">
      <aside className="pwa-install-sheet" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
        <button className="icon-button pwa-install-close" type="button" onClick={dismissPrompt} aria-label="Stäng">
          <X aria-hidden="true" size={20} />
        </button>

        <span className="pwa-install-icon" aria-hidden="true">
          <Smartphone size={28} />
        </span>

        <h2 id="pwa-install-title">{title}</h2>
        <p>{lead}</p>

        {isAndroid ? (
          <button className="button full" type="button" onClick={installApp} disabled={!installPrompt || isInstalling}>
            <Download aria-hidden="true" size={20} />
            {isInstalling ? "Öppnar..." : "Installera appen"}
          </button>
        ) : (
          <ol className="pwa-install-steps">
            {iosSteps.map((step) => {
              const StepIcon = step.icon;

              return (
                <li key={step.text}>
                  <StepIcon aria-hidden="true" size={18} />
                  <span>{step.text}</span>
                </li>
              );
            })}
          </ol>
        )}

        <button className="text-button" type="button" onClick={dismissPrompt}>
          Inte nu
        </button>
      </aside>
    </div>
  );
}
