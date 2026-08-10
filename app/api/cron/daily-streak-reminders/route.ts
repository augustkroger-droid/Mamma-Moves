import webpush, { type PushSubscription } from "web-push";
import { createServerSupabaseAdminClient } from "@/lib/supabase/admin";
import { pauseDaysFromRanges, summarizeStreak, type StreakPauseRange } from "@/lib/streak/streak";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_time: string;
  last_daily_streak_reminder_date: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  started_at: string;
};

type CompletedExerciseRow = {
  workout_session_id: string;
};

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

function stockholmDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function stockholmHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    hour12: false
  }).format(date);

  if (hour === "24") {
    return "00";
  }

  return hour.padStart(2, "0");
}

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth
    }
  };
}

function notificationBody(streak: number) {
  if (streak <= 0) {
    return "En övning räcker för att starta dagens streak. Kom igen, Mamma Moves väntar.";
  }

  if (streak === 1) {
    return "Du har 1 dag i streak. En liten övning idag håller lågan vid liv.";
  }

  return `Du har ${streak} dagar i streak. Håll den levande med ett kort pass idag.`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return Response.json({ ok: false, error: "Missing VAPID keys." }, { status: 500 });
  }

  webpush.setVapidDetails("mailto:mammaworkoutapp@gmail.com", publicKey, privateKey);

  const supabase = createServerSupabaseAdminClient();
  const today = stockholmDateKey();
  const currentHour = stockholmHour();
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, reminder_time, last_daily_streak_reminder_date")
    .eq("daily_streak_enabled", true)
    .like("reminder_time", `${currentHour}:%`);

  if (subscriptionError) {
    return Response.json({ ok: false, error: subscriptionError.message }, { status: 500 });
  }

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();

  for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
    if (subscription.last_daily_streak_reminder_date === today) {
      continue;
    }

    subscriptionsByUser.set(subscription.user_id, [
      ...(subscriptionsByUser.get(subscription.user_id) ?? []),
      subscription
    ]);
  }

  const userIds = [...subscriptionsByUser.keys()];

  if (userIds.length === 0) {
    return Response.json({ ok: true, sent: 0, skipped: 0 });
  }

  const [sessionsResult, pausesResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, user_id, started_at")
      .in("user_id", userIds)
      .in("status", ["completed", "abandoned"]),
    supabase
      .from("streak_pauses")
      .select("user_id, start_date, end_date")
      .in("user_id", userIds)
  ]);

  if (sessionsResult.error) {
    return Response.json({ ok: false, error: sessionsResult.error.message }, { status: 500 });
  }

  if (pausesResult.error) {
    return Response.json({ ok: false, error: pausesResult.error.message }, { status: 500 });
  }

  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const sessionIds = sessions.map((session) => session.id);
  const completedResult = sessionIds.length > 0
    ? await supabase
        .from("workout_session_exercises")
        .select("workout_session_id")
        .eq("completed", true)
        .in("workout_session_id", sessionIds)
    : { data: [], error: null };

  if (completedResult.error) {
    return Response.json({ ok: false, error: completedResult.error.message }, { status: 500 });
  }

  const completedSessionIds = new Set(
    ((completedResult.data ?? []) as CompletedExerciseRow[]).map((exercise) => exercise.workout_session_id)
  );
  const sessionsByUser = new Map<string, SessionRow[]>();

  for (const session of sessions.filter((row) => completedSessionIds.has(row.id))) {
    sessionsByUser.set(session.user_id, [...(sessionsByUser.get(session.user_id) ?? []), session]);
  }

  const pausesByUser = new Map<string, StreakPauseRange[]>();

  for (const pause of (pausesResult.data ?? []) as Array<StreakPauseRange & { user_id: string }>) {
    pausesByUser.set(pause.user_id, [...(pausesByUser.get(pause.user_id) ?? []), pause]);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    const trainedDays = new Set(
      (sessionsByUser.get(userId) ?? []).map((session) => stockholmDateKey(new Date(session.started_at)))
    );
    const pauses = pausesByUser.get(userId) ?? [];
    const pausedDays = pauseDaysFromRanges(pauses);

    if (trainedDays.has(today) || pausedDays.has(today)) {
      skipped += 1;
      continue;
    }

    const streak = summarizeStreak(trainedDays, pauses).currentStreak;
    const payload = JSON.stringify({
      title: "Håll din streak levande",
      body: notificationBody(streak),
      url: "/workouts",
      tag: `daily-streak-${today}`,
      badge: "/icons/icon-192.png",
      icon: "/icons/icon-192.png"
    });

    for (const subscription of subscriptionsByUser.get(userId) ?? []) {
      try {
        await webpush.sendNotification(toPushSubscription(subscription), payload);
        await supabase
          .from("push_subscriptions")
          .update({ last_daily_streak_reminder_date: today, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }
  }

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    date: today,
    sent,
    skipped,
    failed
  });
}
