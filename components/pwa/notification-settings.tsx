"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function supportsPushNotifications() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function NotificationSettings() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubscription() {
      const supported = supportsPushNotifications();
      setIsSupported(supported);

      if (!supported) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
    }

    void loadSubscription();
  }, []);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function enableNotifications() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      setMessage("Notiser är inte färdigkonfigurerade ännu.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Notiser är inte tillåtna på den här enheten.");
        setIsSaving(false);
        return;
      }

      const token = await getAccessToken();

      if (!token) {
        setMessage("Logga in igen för att slå på notiser.");
        setIsSaving(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(subscription.toJSON())
      });

      if (!response.ok) {
        throw new Error("Kunde inte spara notisinställningen.");
      }

      setIsSubscribed(true);
      setMessage("Påminnelser är på. Du får en peppig streak-notis om du inte tränat vid 14-tiden.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte slå på notiser.");
    }

    setIsSaving(false);
  }

  async function disableNotifications() {
    setIsSaving(true);
    setMessage(null);

    try {
      const token = await getAccessToken();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription && token) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setMessage("Påminnelser är avstängda på den här enheten.");
    } catch {
      setMessage("Kunde inte stänga av notiser just nu.");
    }

    setIsSaving(false);
  }

  if (!isSupported) {
    return (
      <section className="card notification-card">
        <div>
          <h2 className="section-title">Streak-påminnelser</h2>
          <p className="muted">Den här webbläsaren stöder inte pushnotiser för PWA.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card notification-card">
      <div>
        <h2 className="section-title">Streak-påminnelser</h2>
        <p className="muted">Få en peppig notis om du inte tränat vid 14-tiden.</p>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      <button
        className={`button ${isSubscribed ? "secondary" : ""} full`}
        type="button"
        onClick={isSubscribed ? disableNotifications : enableNotifications}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="spin" aria-hidden="true" size={20} />
        ) : isSubscribed ? (
          <BellOff aria-hidden="true" size={20} />
        ) : (
          <Bell aria-hidden="true" size={20} />
        )}
        {isSubscribed ? "Stäng av påminnelser" : "Slå på påminnelser"}
      </button>
    </section>
  );
}
