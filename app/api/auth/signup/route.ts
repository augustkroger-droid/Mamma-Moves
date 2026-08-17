import { createServerSupabaseAdminClient } from "@/lib/supabase/admin";

type SignupPayload = {
  email?: string;
  password?: string;
  username?: string;
};

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeUsername(value: string | undefined) {
  return value?.trim() ?? "";
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as SignupPayload;
    const email = normalizeEmail(payload.email);
    const username = normalizeUsername(payload.username);
    const password = payload.password ?? "";

    if (!email || !email.includes("@")) {
      return Response.json({ ok: false, error: "Skriv in en giltig e-postadress." }, { status: 400 });
    }

    if (username.length < 2) {
      return Response.json({ ok: false, error: "Användarnamnet måste vara minst 2 tecken." }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ ok: false, error: "Lösenordet måste vara minst 6 tecken." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdminClient();
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfileError) {
      return Response.json({ ok: false, error: existingProfileError.message }, { status: 500 });
    }

    if (existingProfile) {
      return Response.json({ ok: false, error: "Användarnamnet är redan taget." }, { status: 409 });
    }

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username
      }
    });

    if (createUserError || !createdUser.user) {
      return Response.json(
        { ok: false, error: createUserError?.message ?? "Kunde inte skapa kontot." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error: profileError } = await supabase.from("profiles").insert({
      id: createdUser.user.id,
      username,
      email,
      updated_at: now
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      return Response.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Kunde inte skapa kontot."
      },
      { status: 500 }
    );
  }
}
