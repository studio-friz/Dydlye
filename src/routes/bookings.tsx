import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings, formatPrice } from "@/i18n/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { House } from "@/data/houses";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "حجوزاتي - Dydlye" },
      { name: "description", content: "استعرض حجوزاتك الحالية والسابقة." },
    ],
  }),
  component: BookingsPage,
});

type Booking = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: string;
  amount: number;
  payment_method: string | null;
  payment_ref: string | null;
  created_at: string;
  properties: House | null;
};

function BookingsPage() {
  const { t, dir, currency, locale } = useSettings();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, property_id, start_date, end_date, status, amount, payment_method, payment_ref, created_at, properties(*)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setBookings([]);
      return;
    }
    setBookings((data ?? []) as unknown as Booking[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelBooking = async (b: Booking) => {
    if (!user) return;
    setCancellingId(b.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id)
      .eq("user_id", user.id);
    setCancellingId(null);
    if (error) {
      toast.error(t("bookings.cancelError"));
      return;
    }
    toast.success(t("bookings.cancelSuccess"));
    await load();
  };

  const fmtDate = (d: string) => {
    const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
    return date.toLocaleDateString(
      locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
      { day: "numeric", month: "short", year: "numeric" },
    );
  };

  const nightsOf = (b: Booking) =>
    Math.max(
      0,
      Math.round((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000),
    );

  const statusInfo: Record<string, { key: string; cls: string }> = {
    pending: {
      key: "bookings.statusPending",
      cls: "bg-amber-500/15 text-amber-600",
    },
    confirmed: {
      key: "bookings.statusConfirmed",
      cls: "bg-green-500/15 text-green-600",
    },
    cancelled: {
      key: "bookings.statusCancelled",
      cls: "bg-red-500/15 text-red-500",
    },
  };

  return (
    <SettingsPage title={t("bookings.heading")} subtitle={t("bookings.subtitle")}>
      {!user ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("bookings.loginNeeded")}</p>
        </div>
      ) : bookings === null ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-semibold text-muted-foreground">
            {t("bookings.loading")}
          </span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-card p-12 text-center shadow-sm">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">{t("bookings.empty")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("bookings.emptyHint")}</p>
          <Link
            to="/"
            className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-primary/90"
          >
            {t("bookings.explore")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const nights = nightsOf(b);
            const total =
              b.amount && b.amount > 0 ? b.amount : b.properties ? nights * b.properties.price : 0;
            const status = statusInfo[b.status] ?? statusInfo.pending;
            return (
              <div
                key={b.id}
                className="flex gap-3 rounded-3xl bg-card p-3 shadow-sm transition hover:shadow-md"
                dir={dir}
              >
                {b.properties?.images?.[0] ? (
                  <img
                    src={b.properties.images[0]}
                    alt={b.properties.title}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-24 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="h-28 w-24 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-primary-glow" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-bold text-foreground">
                      {b.properties?.title ?? ""}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.cls}`}
                    >
                      {t(status.key)}
                    </span>
                  </div>
                  {b.properties && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <svg
                        className="h-3 w-3 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {b.properties.city}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("bookings.from")} {fmtDate(b.start_date)} {t("bookings.to")}{" "}
                    {fmtDate(b.end_date)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("bookings.nightsLabel")}: {nights} • {t("bookings.totalLabel")}:{" "}
                    <span className="font-bold text-foreground">
                      {formatPrice(total, currency, locale)}
                    </span>
                  </p>
                  {b.payment_ref && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span>
                        {t("booking.methodLabel")}:{" "}
                        <span className="font-semibold text-foreground">{t("booking.card")}</span>
                      </span>
                      <span className="opacity-40">•</span>
                      <span>
                        {t("booking.reference")}:{" "}
                        <span className="font-semibold text-foreground">{b.payment_ref}</span>
                      </span>
                    </p>
                  )}
                  {b.status !== "cancelled" && (
                    <button
                      onClick={() => void cancelBooking(b)}
                      disabled={cancellingId === b.id}
                      className="mt-2 w-fit rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {cancellingId === b.id ? "..." : t("bookings.cancel")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsPage>
  );
}
