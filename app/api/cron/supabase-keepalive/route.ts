import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { error } = await supabase
    .from("exercises")
    .select("id")
    .limit(1);

  if (error) {
    return Response.json(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        error: error.message
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString()
  });
}
