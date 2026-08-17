import { createClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";
import { createServerSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
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

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return Response.json({ ok: false, error: "Missing VAPID keys." }, { status: 500 });
    }

    webpush.setVapidDetails("mailto:mammaworkoutapp@gmail.com", publicKey, privateKey);

    const supabase = createServerSupabaseAdminClient();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id)
      .eq("daily_streak_enabled", true);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of (data ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          toPushSubscription(subscription),
          JSON.stringify({
            title: "Testnotis från Mamma Moves",
            body: "Om du ser den här fungerar pushnotiser på den här enheten.",
            url: "/stats",
            tag: `test-push-${Date.now()}`,
            badge: "/icons/icon-192.png",
            icon: "/icons/icon-192.png"
          })
        );
        sent += 1;
      } catch (sendError) {
        failed += 1;
        const statusCode = typeof sendError === "object" && sendError && "statusCode" in sendError
          ? (sendError as { statusCode?: number }).statusCode
          : undefined;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }

    return Response.json({ ok: true, sent, failed });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not send test notification."
      },
      { status: 500 }
    );
  }
}
