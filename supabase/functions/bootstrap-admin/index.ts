import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ADMIN_EMAIL = "antony.mwangi.dev@gmail.com";
const ADMIN_PASSWORD = "12345678";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      throw new Error("Supabase credentials are not configured");
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const existing = listed.users.find(
      (user) => user.email?.toLowerCase() === ADMIN_EMAIL,
    );

    if (existing) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password: ADMIN_PASSWORD, email_confirm: true },
      );
      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ ok: true, message: "Admin user password updated." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const { error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw createError;

    return new Response(
      JSON.stringify({ ok: true, message: "Admin user created." }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
