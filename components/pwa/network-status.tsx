"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [showRestoredMessage, setShowRestoredMessage] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setIsOnline(window.navigator.onLine);

    function handleOffline() {
      setIsOnline(false);
      setShowRestoredMessage(false);
    }

    function handleOnline() {
      setIsOnline(true);
      setShowRestoredMessage(true);
      window.setTimeout(() => setShowRestoredMessage(false), 3200);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!hasMounted || (isOnline && !showRestoredMessage)) {
    return null;
  }

  return (
    <aside className={`network-status ${isOnline ? "is-online" : "is-offline"}`} role="status" aria-live="polite">
      {isOnline ? <Wifi aria-hidden="true" size={18} /> : <WifiOff aria-hidden="true" size={18} />}
      <span>{isOnline ? "Du är online igen." : "Du är offline. Sparade sidor kan fortfarande öppnas."}</span>
    </aside>
  );
}
