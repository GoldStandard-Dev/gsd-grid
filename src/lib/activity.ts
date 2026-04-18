import { SupabaseClient } from "@supabase/supabase-js";

// Only the columns that actually exist in activity_log
type ActivityInsertRow = {
  org_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
};

export type ActivityPayload = {
  org_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown> | null;
  // Legacy fields accepted but not written to DB — kept so callers don't break
  actor_profile_id?: string | null;
  parent_entity_type?: string | null;
  parent_entity_id?: string | null;
  title?: string | null;
  description?: string | null;
};

async function resolveActorName(
  client: SupabaseClient,
  userId: string | null,
  provided: string | null,
): Promise<string | null> {
  if (provided?.trim()) return provided;
  if (!userId) return null;

  try {
    const res = await client
      .from("profiles")
      .select("full_name, company_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (res.error) return provided;
    const row = res.data as {
      full_name?: string | null;
      company_name?: string | null;
      email?: string | null;
    } | null;
    return (
      row?.full_name?.trim() ||
      row?.company_name?.trim() ||
      row?.email?.trim() ||
      provided
    );
  } catch {
    return provided;
  }
}

/**
 * Fire-and-forget activity logger.
 * Only writes columns that exist in the activity_log table.
 * Errors are swallowed — callers never need to handle them.
 */
export async function logActivity(
  client: SupabaseClient,
  payload: ActivityPayload,
): Promise<void> {
  try {
    const actorName = await resolveActorName(
      client,
      payload.actor_user_id,
      payload.actor_name,
    );

    const row: ActivityInsertRow = {
      org_id: payload.org_id,
      actor_user_id: payload.actor_user_id,
      actor_name: actorName,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      details: payload.details ?? {},
    };

    const { error } = await client.from("activity_log").insert(row);
    if (error) console.warn("[activity]", error.message);
  } catch (e) {
    console.warn("[activity]", e);
  }
}
