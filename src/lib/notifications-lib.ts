import { supabase } from "@/lib/supabase/client";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
}

/**
 * Inserează o notificare pentru un utilizator specific.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.user_id,
    title: params.title,
    message: params.message,
    type: params.type || "info",
    link: params.link || null,
  });
  if (error) {
    console.error("[createNotification] error:", error.message);
  }
}

/**
 * Inserează o notificare pentru mai mulți utilizatori simultan.
 */
export async function createNotificationForMany(
  userIds: string[],
  params: Omit<CreateNotificationParams, "user_id">
) {
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    title: params.title,
    message: params.message,
    type: params.type || "info",
    link: params.link || null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[createNotificationForMany] error:", error.message);
  }
}

/**
 * Returneaza toti userii cu rolurile specificate (pentru a trimite notificari catre ei).
 */
export async function getUserIdsByRoles(roles: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("role", roles);
  if (error || !data) return [];
  return data.map((p: { id: string }) => p.id);
}

/**
 * Marcheaza toate notificarile unui user ca citite.
 */
export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

/**
 * Marcheaza o notificare specifica ca citita.
 */
export async function markNotificationRead(notificationId: string) {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}
