import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const today = `${year}-${month}-${day}`;
    const stopIso = new Date(`${today}T17:00:00`).toISOString();

    const { data: activeEntries, error: fetchError } = await supabase
      .from("time_entries")
      .select("id")
      .eq("work_date", today)
      .eq("status", "activ")
      .is("end_time", null);

    if (fetchError) {
      return new Response(
        JSON.stringify({ ok: false, step: "fetch", error: fetchError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!activeEntries || activeEntries.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, updated: 0, message: "No active entries" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const ids = activeEntries.map((entry) => entry.id);

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        end_time: stopIso,
        status: "oprit",
      })
      .in("id", ids);

    if (updateError) {
      return new Response(
        JSON.stringify({ ok: false, step: "update", error: updateError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, updated: ids.length, stopped_at: stopIso }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});