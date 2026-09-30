import { supabase } from "./supabase";

/**
 * Admin request layer.
 *
 * Every call below is a POST to the `admin-api` Edge Function, which owns the
 * service_role key on the server and verifies that the signed-in user is listed
 * in `public.admins`. The browser only ever holds the publishable key, so the
 * panel can be deployed publicly without exposing the database.
 *
 * The exported shape is unchanged from the previous direct-database version, so
 * the pages in ../pages keep working as they are.
 */

export class AdminApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

type EdgeResult<T> = { ok: true } & T & { error?: never };

/** Invokes admin-api and normalises every failure into AdminApiError. */
async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`admin-api/${action}`, {
    body: { action, ...body },
  });

  if (error) {
    // A network/CORS/404 failure never reaches the router, so it has no status.
    const status = "status" in error && typeof error.status === "number" ? error.status : 500;
    throw new AdminApiError(await readFunctionError(error, status), status);
  }

  const result = data as EdgeResult<T> | { ok: false; error?: string } | null;
  if (!result) throw new AdminApiError("استجابة غير صالحة من الخادم", 500);
  if (result.ok === false) {
    const message = typeof result.error === "string" ? result.error : "فشلت العملية";
    throw new AdminApiError(message, statusFromMessage(message));
  }
  return result as T;
}

/**
 * The function answers with a JSON body even on 4xx/5xx, but supabase-js wraps
 * it in a FunctionsHttpError whose context is not always readable. Fall back to
 * a generic Arabic message rather than leaking a raw stack.
 */
async function readFunctionError(error: unknown, status: number): Promise<string> {
  const anyErr = error as { context?: Response };
  try {
    const res = anyErr?.context;
    if (res && typeof res.json === "function") {
      const body = (await res.json()) as { error?: string };
      if (typeof body?.error === "string" && body.error) return body.error;
    }
  } catch {
    // Body was not JSON — fall through to the generic message.
  }
  if (status === 401) return "انتهت الجلسة، يرجى تسجيل الدخول من جديد";
  if (status === 403) return "هذا الحساب ليس حساب مشرف";
  return "تعذّر الاتصال بالخادم";
}

/** admin-api reports auth problems as messages, not always as a status field. */
function statusFromMessage(message: string): number {
  if (/session|token|sign in|unauthorized/i.test(message)) return 401;
  if (/administrator access/i.test(message)) return 403;
  return 500;
}

// ---------------------------------------------------------------------------
// Row shapes (mirror the SQL schema)
// ---------------------------------------------------------------------------
export interface AdminProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_host: boolean;
  blocked: boolean;
  updated_at: string;
}

export interface Destination {
  id: string;
  name: string;
  description: string | null;
  category: string;
  city: string;
  location: string | null;
  lat: number;
  lng: number;
  images: string[] | null;
  phone: string | null;
  opening_hours: string | null;
  rating: number | null;
  reviews: number | null;
  country: string | null;
  sort_order: number;
}

export interface Country {
  id: string;
  name: string;
  image: string | null;
}

export interface AdminProperty {
  id: string;
  title: string;
  city: string;
  price: number;
  images: string[] | null;
  owner_id: string | null;
  created_at: string;
  description?: string | null;
  type?: string | null;
  location?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  features?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  rating?: number | null;
  reviews?: number | null;
  owner?: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

export interface Report {
  id: string;
  property_id: string;
  reporter_id: string | null;
  reason: string | null;
  details: string | null;
  status: "new" | "reviewed" | "resolved" | null;
  created_at: string;
  property?: {
    title: string;
    owner_id: string | null;
    owner?: { full_name: string | null } | null;
  } | null;
  reporter?: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  description: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Stats {
  counts: {
    properties: number;
    destinations: number;
    profiles: number;
    comments: number;
    bookings: number;
    favorites: number;
    hosts: number;
    blocked: number;
    cities: number;
    owners: number;
    activeUsers: number;
  };
  propertiesByCity: Record<string, number>;
  destinationsByCategory: Record<string, number>;
  destinationsByCity: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
export const adminApi = {
  /** Confirms the session is valid *and* that the user is in `public.admins`. */
  whoami: async (): Promise<{ id: string; email: string | null }> => {
    const { user } = await call<{ user: { id: string; email: string | null } }>("whoami");
    return user;
  },

  stats: async (): Promise<Stats> => {
    const { counts, propertiesByCity, destinationsByCategory, destinationsByCity } = await call<
      Omit<Stats, "counts"> & { counts: Stats["counts"] }
    >("stats");
    return { counts, propertiesByCity, destinationsByCategory, destinationsByCity };
  },

  users: {
    list: async (): Promise<{ data: AdminProfile[] }> =>
      call<{ data: AdminProfile[] }>("users.list"),

    setBlocked: async (userId: string, blocked: boolean): Promise<{ blocked: boolean }> =>
      call<{ blocked: boolean }>("users.setBlocked", { userId, blocked }),

    /** Removes every property owned by the user, then blocks the account. */
    blockDeep: async (userId: string): Promise<{ blocked: boolean; deleted: number }> =>
      call<{ blocked: boolean; deleted: number }>("users.blockDeep", { userId }),
  },

  properties: {
    list: async (): Promise<{
      data: AdminProperty[];
      reportCounts: Record<string, number>;
    }> => call<{ data: AdminProperty[]; reportCounts: Record<string, number> }>("properties.list"),

    get: async (id: string): Promise<{ data: AdminProperty | null }> =>
      call<{ data: AdminProperty | null }>("properties.get", { id }),

    save: async (payload: Record<string, unknown>): Promise<{ data: AdminProperty }> =>
      call<{ data: AdminProperty }>("properties.save", payload),

    remove: async (ids: string[]): Promise<{ deleted: number }> =>
      call<{ deleted: number }>("properties.delete", { ids }),

    /** Also removes reports and comments before deleting the rows. */
    removeDeep: async (ids: string[]): Promise<{ deleted: number }> =>
      call<{ deleted: number }>("properties.deleteDeep", { ids }),
  },

  destinations: {
    list: async (): Promise<{
      destinations: Destination[];
      countries: Country[];
    }> => call<{ destinations: Destination[]; countries: Country[] }>("destinations.list"),

    get: async (id: string): Promise<{ data: Destination | null }> =>
      call<{ data: Destination | null }>("destinations.get", { id }),

    save: async (payload: Record<string, unknown>): Promise<{ data: Destination }> =>
      call<{ data: Destination }>("destinations.save", payload),

    remove: async (id: string): Promise<{ ok: true }> =>
      call<{ ok: true }>("destinations.delete", { id }),

    reorder: async (order: { id: string; sort: number }[]): Promise<{ updated: number }> =>
      call<{ updated: number }>("destinations.reorder", { order }),

    assignCountry: async (id: string, country: string, sortOrder: number): Promise<{ ok: true }> =>
      call<{ ok: true }>("destinations.assignCountry", { id, country, sortOrder }),

    detachCountry: async (id: string): Promise<{ ok: true }> =>
      call<{ ok: true }>("destinations.detachCountry", { id }),

    saveCountry: async (name: string, image: string | null): Promise<{ ok: true }> =>
      call<{ ok: true }>("countries.save", { name, image }),

    deleteCountry: async (name: string): Promise<{ ok: true }> =>
      call<{ ok: true }>("countries.delete", { name }),
  },

  reports: {
    list: async (): Promise<{ data: Report[] }> => call<{ data: Report[] }>("reports.list"),

    setStatus: async (id: string, status: Report["status"]): Promise<{ status: string }> =>
      call<{ status: string }>("reports.setStatus", { id, status }),

    remove: async (id: string): Promise<{ ok: true }> =>
      call<{ ok: true }>("reports.delete", { id }),
  },

  promo: {
    list: async (): Promise<{ data: PromoCode[] }> => call<{ data: PromoCode[] }>("promo.list"),

    get: async (id: string): Promise<{ data: PromoCode }> =>
      call<{ data: PromoCode }>("promo.get", { id }),

    save: async (payload: Record<string, unknown>): Promise<{ data: PromoCode }> =>
      call<{ data: PromoCode }>("promo.save", payload),

    setActive: async (id: string, isActive: boolean): Promise<{ ok: true }> =>
      call<{ ok: true }>("promo.setActive", { id, is_active: isActive }),

    remove: async (id: string): Promise<{ ok: true }> => call<{ ok: true }>("promo.delete", { id }),
  },
};

/**
 * Uploads a file to a public bucket through a short-lived signed token that
 * admin-api issues, then returns its public URL. The service_role key is never
 * involved.
 */
export async function uploadImage(bucket: string, file: File): Promise<string> {
  const safeExt = (file.name.split(".").pop() ?? "webp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt || "webp"}`;

  const { token, path } = await call<{ token: string; path: string }>("storage.signedUpload", {
    bucket,
    name,
  });

  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, { cacheControl: "3600" });
  if (error) throw new AdminApiError(error.message, 500);

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
