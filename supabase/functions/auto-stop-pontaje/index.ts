import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "Europe/Bucharest";

function getRomaniaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    today: `${map.year}-${map.month}-${map.day}`,
  };
}

function getRomaniaOffset(date = new Date()) {
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  }).format(date);

  const match = tzString.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+02:00";
}

Deno.serve(async (_req) => {
  try {
    const nowRoString = new Date().toLocaleString("en-US", {
      timeZone: "Europe/Bucharest",
    });

    const nowRo = new Date(nowRoString);
    const hour = nowRo.getHours();

    if (hour < 17) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Nu e încă 17:00 România",
          currentHour: hour,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const ro = getRomaniaDateParts(now);

    if (ro.hour < 17) {
      return new Response(
        JSON.stringify({
          ok: true,
          updated: 0,
          message: "Romania time is before 17:00",
          romania_today: ro.today,
          romania_hour: ro.hour,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const offset = getRomaniaOffset(now);
    const stopIso = new Date(`${ro.today}T17:00:00${offset}`).toISOString();

    const { data: activeEntries, error: fetchError } = await supabase
      .from("time_entries")
      .select("id, project_id")
      .eq("work_date", ro.today)
      .eq("status", "activ")
      .is("end_time", null);

    if (fetchError) {
      return new Response(
        JSON.stringify({
          ok: false,
          step: "fetch",
          error: fetchError.message,
          romania_today: ro.today,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!activeEntries || activeEntries.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          updated: 0,
          message: "No active entries",
          romania_today: ro.today,
          stopped_at: stopIso,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const ids = activeEntries.map((entry) => entry.id);

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({ end_time: stopIso, status: "oprit" })
      .in("id", ids);

    if (updateError) {
      return new Response(
        JSON.stringify({
          ok: false,
          step: "update",
          error: updateError.message,
          romania_today: ro.today,
          ids_count: ids.length,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── NOTIFICARI PONTAJE INCHEIATE ──
    const projectIds = [
      ...new Set(
        activeEntries.map((e: any) => e.project_id).filter(Boolean)
      ),
    ] as string[];

    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      const projectMap = new Map(
        (projects || []).map((p: any) => [p.id, p.name])
      );

      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["administrator", "cont_tehnic"]);

      const adminIds = (adminProfiles || []).map((p: any) => p.id);

      if (adminIds.length > 0) {
        const notifications: any[] = [];

        for (const projectId of projectIds) {
          const projectName =
            projectMap.get(projectId) || "Șantier necunoscut";
          for (const adminId of adminIds) {
            notifications.push({
              user_id: adminId,
              title: "Pontaje încheiate",
              message: `Pontajele din șantierul ${projectName} au fost închise pentru azi.`,
              type: "info",
              link: "/admin/istoric-pontaje",
            });
          }
        }

        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }
    }
    // ── SFARSIT NOTIFICARI ──

    return new Response(
      JSON.stringify({
        ok: true,
        updated: ids.length,
        romania_today: ro.today,
        stopped_at: stopIso,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});