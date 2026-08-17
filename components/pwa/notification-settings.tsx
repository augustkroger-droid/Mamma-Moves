"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2, Save, Send } from "lucide-react";
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

const reminderTimeOptions = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, "0")}:00`);
const defaultReminderTime = "14:00";

export function NotificationSettings() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reminderTime, setReminderTime] = useState(defaultReminderTime);
  const [message, setMessage] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const saveSubscriptionForTime = useCallback(async (subscription: PushSubscription, time: string) => {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("Logga in igen för att spara notisinställningen.");
    }

    const subscriptionJson = subscription.toJSON();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ ...subscriptionJson, reminderTime: time })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(result?.error ?? "Kunde inte spara notisinställningen.");
    }
  }, [getAccessToken]);

  useEffect(() => {
    async function loadSubscription() {
      const supported = supportsPushNotifications();
      setIsSupported(supported);

      if (!supported) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          setIsSubscribed(false);
          return;
        }

        const token = await getAccessToken();

        if (!token) {
          setIsSubscribed(false);
          setMessage("Logga in igen för att aktivera påminnelser på den här enheten.");
          return;
        }

        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("reminder_time")
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        if (error) {
          setIsSubscribed(false);
          setMessage("Kunde inte läsa notisinställningen just nu.");
          return;
        }

        if (data?.reminder_time) {
          setReminderTime(data.reminder_time.slice(0, 5));
          setIsSubscribed(true);
          return;
        }

        await saveSubscriptionForTime(subscription, defaultReminderTime);
        setIsSubscribed(true);
        setMessage("Påminnelser är aktiva igen på den här enheten.");
      } catch (error) {
        setIsSubscribed(false);
        setMessage(error instanceof Error ? error.message : "Kunde inte kontrollera notisinställningen.");
      }
    }

    void loadSubscription();
  }, [getAccessToken, saveSubscriptionForTime, supabase]);

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

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      try {
        await saveSubscriptionForTime(subscription, reminderTime);
      } catch (error) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        throw error;
      }

      setIsSubscribed(true);
      setMessage(`Påminnelser är på. Du får en peppig streak-notis runt ${reminderTime} om du inte tränat.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte slå på notiser.");
    }

    setIsSaving(false);
  }

  async function saveReminderTime() {
    setIsSaving(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        setMessage("Slå på påminnelser igen för att välja tid.");
        setIsSaving(false);
        return;
      }

      await saveSubscriptionForTime(subscription, reminderTime);
      setIsSubscribed(true);
      setMessage(`Påminnelsetiden är sparad till ${reminderTime}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte spara påminnelsetiden.");
    }

    setIsSaving(false);
  }

  async function sendTestNotification() {
    setIsSaving(true);
    setMessage(null);

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Logga in igen för att skicka en testnotis.");
      }

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const result = await response.json().catch(() => null) as { sent?: number; failed?: number; error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Kunde inte skicka testnotisen.");
      }

      if ((result?.sent ?? 0) > 0) {
        setMessage("Testnotis skickad. Om den inte syns, kontrollera att notiser är tillåtna för appen i mobilen.");
      } else if ((result?.failed ?? 0) > 0) {
        setMessage("Testnotisen kunde inte levereras. Stäng av påminnelser och slå på dem igen på den här enheten.");
      } else {
        setMessage("Ingen aktiv notisprenumeration hittades för den här användaren.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte skicka testnotisen.");
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
        <p className="muted">Välj när du vill få en peppig notis om du inte tränat den dagen.</p>
      </div>
      <label className="form-field notification-time-field">
        <span>Påminnelsetid</span>
        <select
          value={reminderTime}
          onChange={(event) => setReminderTime(event.target.value)}
        >
          {reminderTimeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </label>
      {message ? <p className="form-message">{message}</p> : null}
      <div className="notification-actions">
        <button
          className="button full"
          type="button"
          onClick={isSubscribed ? saveReminderTime : enableNotifications}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="spin" aria-hidden="true" size={20} />
          ) : isSubscribed ? (
            <Save aria-hidden="true" size={20} />
          ) : (
            <Bell aria-hidden="true" size={20} />
          )}
          {isSubscribed ? "Spara påminnelsetid" : "Slå på påminnelser"}
        </button>
        {isSubscribed ? (
          <button
            className="button secondary full"
            type="button"
            onClick={sendTestNotification}
            disabled={isSaving}
          >
            <Send aria-hidden="true" size={20} />
            Skicka testnotis
          </button>
        ) : null}
        {isSubscribed ? (
          <button
            className="button secondary full"
            type="button"
            onClick={disableNotifications}
            disabled={isSaving}
          >
            <BellOff aria-hidden="true" size={20} />
            Stäng av
          </button>
        ) : null}
      </div>
    </section>
  );
}
