import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
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

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await request.json() as PushSubscriptionPayload;

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      return Response.json({ ok: false, error: "Invalid subscription." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: request.headers.get("user-agent"),
      daily_streak_enabled: true,
      last_seen_at: now,
      updated_at: now
    }, { onConflict: "endpoint" });

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save push subscription."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await request.json() as { endpoint?: string };

    if (!endpoint) {
      return Response.json({ ok: false, error: "Missing endpoint." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdminClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete push subscription."
      },
      { status: 500 }
    );
  }
}
