import { adminApi } from "@/lib/adminApi";

/**
 * Thin wrapper kept for backwards compatibility with the existing pages.
 *
 * Every operation here is executed by the `admin-api` Edge Function, which
 * holds the service_role key server-side and verifies the caller against
 * public.admins. Nothing in this file talks to the database directly any more.
 */

type ActionResult = { ok: true; deleted: number } | { ok: false; error: string };

function toResult(promise: Promise<{ deleted: number }>): Promise<ActionResult> {
  return promise
    .then((r) => ({ ok: true as const, deleted: r.deleted }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "فشلت العملية",
    }));
}

export async function deletePropertiesDeep(propertyIds: string[]): Promise<ActionResult> {
  if (propertyIds.length === 0) return { ok: true, deleted: 0 };
  return toResult(adminApi.properties.removeDeep(propertyIds));
}

export async function blockUserAndDeleteProperties(userId: string): Promise<ActionResult> {
  return toResult(adminApi.users.blockDeep(userId));
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  return adminApi.users
    .setBlocked(userId, blocked)
    .then(() => ({ ok: true as const, deleted: 0 }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "فشلت العملية",
    }));
}

export async function reorderDestinations(ordered: { id: string }[]): Promise<ActionResult> {
  return adminApi.destinations
    .reorder(ordered.map((d, i) => ({ id: d.id, sort: i + 1 })))
    .then(() => ({ ok: true as const, deleted: 0 }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "فشل حفظ الترتيب",
    }));
}

export async function assignDestinationToCountry(
  id: string,
  country: string | null,
  sortOrder: number,
): Promise<ActionResult> {
  const call =
    country === null
      ? adminApi.destinations.detachCountry(id)
      : adminApi.destinations.assignCountry(id, country, sortOrder);
  return call
    .then(() => ({ ok: true as const, deleted: 0 }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "فشل تحديث الوجهة",
    }));
}

export async function removeDestinationFromCountry(id: string): Promise<ActionResult> {
  return assignDestinationToCountry(id, null, 0);
}

export async function deleteCountry(name: string): Promise<ActionResult> {
  return adminApi.destinations
    .deleteCountry(name)
    .then(() => ({ ok: true as const, deleted: 0 }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "فشل حذف الدولة",
    }));
}
