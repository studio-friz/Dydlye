import { memo, useState, useRef, useEffect } from "react";
import type { House } from "@/data/houses";
import { toast } from "sonner";
import { useSettings, formatPrice } from "@/i18n/useTranslation";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useComments";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

interface Props {
  house: House | null;
  onClose: () => void;
  onGetDirections?: () => void;
  onRatingUpdated?: (rating: number, reviews: number) => void;
}

export const HouseDetailSheet = memo(function HouseDetailSheet({
  house,
  onClose,
  onGetDirections,
  onRatingUpdated,
}: Props) {
  const { t, dir, currency, locale } = useSettings();
  const { has, toggle } = useFavorites();
  const navigate = useNavigate();
  const [activeImg, setActiveImg] = useState(0);
  const [clean, setClean] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingRange, setBookingRange] = useState<DateRange | undefined>();
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingStep, setBookingStep] = useState<"dates" | "payment">("dates");
  const [paymentRef, setPaymentRef] = useState("");
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try {
      return !localStorage.getItem("dydlye_swipe_hint_seen");
    } catch {
      return true;
    }
  });
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [userRating, setUserRating] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const {
    comments,
    loading: commentsLoading,
    addComment,
    deleteComment,
  } = useComments(house?.id ?? null);

  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
      try {
        localStorage.setItem("dydlye_swipe_hint_seen", "1");
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const startPress = () => {
    if (pressTimer.current !== null) return;
    pressTimer.current = window.setTimeout(() => {
      setClean((v) => !v);
      pressTimer.current = null;
    }, 550);
  };

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    };
  }, []);

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
      return `https://wa.me/212${cleanPhone.substring(1)}`;
    }
    if (cleanPhone.startsWith("212")) {
      return `https://wa.me/${cleanPhone}`;
    }
    if (cleanPhone.length === 9) {
      return `https://wa.me/212${cleanPhone}`;
    }
    return `https://wa.me/${cleanPhone}`;
  };

  if (!house) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const width = e.currentTarget.offsetWidth;
    const scrollLeft = e.currentTarget.scrollLeft;
    const index = Math.round(Math.abs(scrollLeft) / width);
    setActiveImg(index);
  };

  const scrollToImage = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement;
    if (child) {
      el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }
  };

  const nextImg = () => {
    if (activeImg < (house.images?.length || 0) - 1) {
      scrollToImage(activeImg + 1);
    }
  };

  const prevImg = () => {
    if (activeImg > 0) {
      scrollToImage(activeImg - 1);
    }
  };

  const submitReport = async () => {
    if (!reportReason) {
      toast.error(t("report.reasonRequired"));
      return;
    }
    setReportSubmitting(true);
    const { error } = await supabase.from("property_reports").insert({
      property_id: house.id,
      reporter_id: user?.id ?? null,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      toast.error(t("report.error"));
      return;
    }
    toast.success(t("report.sent"));
    setShowReport(false);
    setReportReason("");
    setReportDetails("");
  };

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fmtDateLabel = (d: Date) =>
    d.toLocaleDateString(locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const openBooking = () => {
    setBookingRange(undefined);
    setBookingSuccess(false);
    setBookingStep("dates");
    setPaymentRef("");
    setShowBooking(true);
  };

  const bookingNights =
    bookingRange?.from && bookingRange?.to
      ? Math.round((bookingRange.to.getTime() - bookingRange.from.getTime()) / 86400000)
      : 0;

  const bookingTotal = bookingNights * house.price;

  const goToPayment = () => {
    if (!bookingRange?.from || !bookingRange?.to) {
      toast.error(t("booking.datesRequired"));
      return;
    }
    if (bookingNights <= 0) {
      toast.error(t("booking.invalidRange"));
      return;
    }
    setBookingStep("payment");
  };

  const handlePay = async () => {
    if (!user) {
      toast.error(t("booking.error"));
      return;
    }
    if (!bookingRange?.from || !bookingRange?.to) {
      toast.error(t("booking.datesRequired"));
      return;
    }
    if (bookingNights <= 0) {
      toast.error(t("booking.invalidRange"));
      return;
    }

    setBookingSubmitting(true);

    // The booking is created by the create_booking() RPC, which computes the
    // amount from the stored nightly price and forces status='pending'. The
    // client can no longer post its own amount, status or payment reference.
    // (This build has no payment provider wired up yet, so nothing is charged.)
    const { data, error } = await supabase.rpc("create_booking", {
      p_property_id: house.id,
      p_start_date: fmtDate(bookingRange.from),
      p_end_date: fmtDate(bookingRange.to),
    });

    setBookingSubmitting(false);
    if (error) {
      console.error("create_booking error:", error);
      toast.error(t("booking.error"));
      return;
    }
    setPaymentRef(typeof data === "string" ? data.slice(0, 8).toUpperCase() : "");
    setBookingSuccess(true);
  };
  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`relative animate-slide-up flex h-dvh w-full flex-col overflow-hidden bg-card ${showSwipeHint ? "animate-sheet-drag-hint" : ""}`}
        onClick={(e) => e.stopPropagation()}
        dir={dir}
      >
        <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className={`relative h-dvh w-full shrink-0 select-none overflow-hidden ${
              clean ? "bg-black" : "bg-muted"
            }`}
          >
            {house.images && house.images.length > 0 ? (
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex h-full w-full snap-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {house.images.map((img, i) => (
                  <div key={i} className="h-full w-full shrink-0 snap-center">
                    <img
                      src={img}
                      alt={`${house.title} - ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className={`h-full w-full ${clean ? "object-contain" : "object-cover"}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary to-primary-glow" />
            )}

            {!clean && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            )}

            {/* Navigation Buttons */}
            {!clean && house.images && house.images.length > 1 && (
              <>
                <button
                  onClick={prevImg}
                  disabled={activeImg === 0}
                  className="absolute start-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 disabled:opacity-0"
                >
                  <svg
                    className="h-5 w-5 rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  onClick={nextImg}
                  disabled={activeImg === house.images.length - 1}
                  className="absolute end-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 disabled:opacity-0"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Pagination Dots */}
                <div className="absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
                  {house.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToImage(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${activeImg === i ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}

            {!clean && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 pt-24 text-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sm font-bold">{house.rating}</span>
                    {house.reviews > 0 && (
                      <span className="text-xs opacity-90">
                        {t("detail.reviews", String(house.reviews))}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    {house.type}
                  </span>
                </div>
                <h2 className="mt-1.5 text-3xl font-extrabold leading-tight drop-shadow-md">
                  {house.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-95">
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {house.city}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-amber-300">
                    {formatPrice(house.price, currency, locale)}
                  </span>
                  <span className="text-xs opacity-90">{t("detail.monthly")}</span>
                </div>

                <div className="pointer-events-auto mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onGetDirections}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/20 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/30 active:scale-95"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {t("detail.directions")}
                    </button>
                    <button
                      onClick={() => setShowContact(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/20 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/30 active:scale-95"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.11-1.29a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {t("detail.call")}
                    </button>
                  </div>
                  <button
                    onClick={openBooking}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:opacity-90 active:scale-95"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {t("detail.book")}
                  </button>
                </div>
              </div>
            )}

            {!clean && showSwipeHint && (
              <div className="pointer-events-none absolute left-1/2 top-[40%] z-20 flex -translate-x-1/2 flex-col items-center gap-2.5">
                <svg
                  className="h-7 w-7 animate-bounce-y text-white drop-shadow-lg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15" />
                  <polyline points="18 21 12 15 6 21" />
                </svg>
                <div className="flex animate-swipe-hint flex-col items-center gap-2">
                  <div className="flex h-13 w-13 items-center justify-center rounded-full border border-white/30 bg-white/25 p-2.5 text-white shadow-lg backdrop-blur">
                    <svg className="h-full w-full fill-current" viewBox="0 0 24 24">
                      <path d="M11.5 2a1.5 1.5 0 0 1 1.5 1.5V9.5a.5.5 0 0 0 1 0V6.5a1.5 1.5 0 0 1 3 0V11a.5.5 0 0 0 1 0V8.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.9a5.4 5.4 0 0 1-4.17-1.99l-3.44-4.28a2 2 0 0 1 3.12-2.5l.9 1.12V3.5A1.5 1.5 0 0 1 11.5 2z" />
                    </svg>
                  </div>
                  <span className="rounded-full bg-black/50 px-4 py-1.5 text-xs font-bold text-white backdrop-blur">
                    {t("detail.swipeUp")}
                  </span>
                </div>
              </div>
            )}

            {!clean && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(house.id);
                }}
                className="absolute start-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-black/70 active:scale-90"
                aria-label={has(house.id) ? t("fav.remove") : t("fav.add")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={has(house.id) ? "#ef4444" : "none"}
                  stroke={has(house.id) ? "#ef4444" : "white"}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
            )}
            {!clean && (
              <button
                onClick={() => setShowReport(true)}
                className="absolute end-14 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-red-500/80 active:scale-90"
                aria-label={t("report.title")}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            )}
            {!clean && (
              <button
                onClick={onClose}
                className="absolute end-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-black/70 active:scale-90"
                aria-label={t("detail.close")}
              >
                ✕
              </button>
            )}

            {clean && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur animate-in fade-in">
                {t("detail.fullscreenHint")}
              </div>
            )}
          </div>

          <div className="space-y-5 p-6" dir={dir}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: t("detail.bedrooms"), v: house.bedrooms },
                { l: t("detail.bathrooms"), v: house.bathrooms },
                { l: t("detail.area"), v: `${house.area} ${t("card.area")}` },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-surface p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{s.v}</div>
                  <div className="text-[11px] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">{house.description}</p>

            <div>
              <div className="mb-2 text-xs font-bold text-foreground">{t("detail.features")}</div>
              <div className="flex flex-wrap gap-2">
                {house.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
                  >
                    ✦ {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{t("detail.comments")}</h3>
                <span className="text-xs text-muted-foreground">
                  {commentsLoading
                    ? t("detail.loading")
                    : `${comments.length} ${t("detail.commentCount")}`}
                </span>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-2xl bg-secondary/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">{c.user_name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString(
                              locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                          {user && c.user_id === user.id && (
                            <button
                              onClick={async () => {
                                const result = await deleteComment(c.id);
                                if (result.ok) {
                                  toast.success(t("detail.commentDeleted"));
                                  if (result.rating != null && result.reviews != null) {
                                    onRatingUpdated?.(result.rating, result.reviews);
                                  }
                                } else {
                                  toast.error(t("detail.commentDeleteError"));
                                }
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-500 transition hover:bg-red-500/20 active:scale-90"
                              aria-label="Delete"
                            >
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </span>
                      </div>
                      {c.rating > 0 && (
                        <div className="flex items-center gap-0.5 mb-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`h-3 w-3 ${star <= c.rating ? "fill-accent" : "fill-muted"}`}
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                !commentsLoading && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {t("detail.noComments")}
                  </p>
                )
              )}

              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground ml-2">
                      {t("detail.yourRating")}
                    </span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star === userRating ? 0 : star)}
                        className="transition active:scale-125"
                      >
                        <svg
                          className={`h-5 w-5 ${star <= userRating ? "fill-accent" : "fill-muted/40 stroke-muted-foreground/30"}`}
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t("detail.commentPlaceholder")}
                      className="flex-1 rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      onClick={async () => {
                        if (!commentText.trim()) return;
                        const result = await addComment(commentText.trim(), userRating);
                        if (result.ok) {
                          setCommentText("");
                          setUserRating(0);
                          if (result.rating != null && result.reviews != null) {
                            onRatingUpdated?.(result.rating, result.reviews);
                          }
                          toast.success(t("detail.commentAdded"));
                        } else {
                          toast.error(t("detail.commentError"));
                        }
                      }}
                      disabled={!commentText.trim()}
                      className="shrink-0 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-glow active:scale-95 disabled:opacity-50"
                    >
                      {t("detail.send")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {t("detail.loginToComment")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Options Overlay */}
        {showContact && (
          <div
            className="absolute inset-0 z-[510] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in animate-duration-200"
            onClick={() => setShowContact(false)}
          >
            <div
              className="w-full rounded-t-[2rem] bg-card p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/60" />
              <h3 className="text-center text-lg font-bold text-foreground mb-4">
                {t("detail.contactOptions")}
              </h3>

              <div className="flex flex-col gap-3">
                {/* 1. Phone Call */}
                <a
                  href={`tel:${house.phone}`}
                  onClick={() => setShowContact(false)}
                  className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4 text-primary hover:bg-primary/15 transition active:scale-[0.98]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.11-1.29a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{t("detail.phoneCall")}</div>
                    <div className="text-xs text-muted-foreground">{house.phone}</div>
                  </div>
                </a>

                {/* 2. WhatsApp */}
                <a
                  href={getWhatsAppLink(house.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowContact(false)}
                  className="flex items-center gap-3 rounded-2xl bg-green-500/10 p-4 text-green-600 hover:bg-green-500/15 transition active:scale-[0.98]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-white">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.488 1.459 5.416 1.46.008 0 .016 0 .025 0 5.485 0 9.95-4.461 9.953-9.94.002-2.657-1.03-5.153-2.91-7.03C17.25 1.765 14.757.734 12.1.734c-5.484 0-9.95 4.462-9.953 9.943-.001 1.93.504 3.812 1.46 5.418l-.995 3.637 3.725-.978zm11.367-7.794c-.314-.157-1.86-.92-2.148-1.025-.289-.106-.5-.157-.712.156-.21.314-.817 1.025-1.002 1.234-.186.209-.372.236-.686.079-.314-.157-1.327-.489-2.528-1.562-.93-.83-1.558-1.854-1.74-2.169-.183-.314-.02-.485.137-.641.141-.14.314-.367.47-.55.157-.184.21-.314.314-.524.105-.21.053-.393-.026-.55-.079-.158-.712-1.716-.976-2.348-.257-.617-.518-.533-.712-.533-.184-.004-.396-.004-.608-.004-.212 0-.557.08-.847.397-.29.314-1.107 1.082-1.107 2.637 0 1.556 1.13 3.06 1.288 3.27.158.21 2.22 3.391 5.378 4.75.75.324 1.337.518 1.795.663.755.24 1.442.207 1.986.126.607-.09 1.86-.76 2.122-1.46.262-.699.262-1.303.184-1.427-.079-.12-.289-.197-.604-.355z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{t("detail.whatsapp")}</div>
                    <div className="text-xs text-muted-foreground">{t("detail.whatsappDesc")}</div>
                  </div>
                </a>

                {/* 3. Copy Number */}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(house.phone);
                      toast.success(t("detail.copySuccess"));
                    } catch (err) {
                      toast.error(t("detail.copyFailed"));
                    }
                    setShowContact(false);
                  }}
                  className="flex items-center gap-3 rounded-2xl bg-slate-500/10 p-4 text-slate-700 dark:text-slate-300 hover:bg-slate-500/15 transition active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500 text-white">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-sm">{t("detail.copyNumber")}</div>
                    <div className="text-xs text-muted-foreground">{t("detail.copyClipboard")}</div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowContact(false)}
                className="mt-4 w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
              >
                {t("detail.cancel")}
              </button>
            </div>
          </div>
        )}
        {showReport && (
          <div
            className="absolute inset-0 z-[510] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in animate-duration-200"
            onClick={() => setShowReport(false)}
          >
            <div
              className="w-full rounded-t-[2rem] bg-card p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/60" />
              <h3 className="mb-4 text-center text-lg font-bold text-foreground">
                {t("report.title")}
              </h3>

              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("report.reasons")}
              </p>
              <div className="flex flex-col gap-2">
                {[
                  "report.wrongInfo",
                  "report.fakePrice",
                  "report.scam",
                  "report.rented",
                  "report.other",
                ].map((key) => (
                  <button
                    key={key}
                    onClick={() => setReportReason(key)}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-bold transition active:scale-[0.98] ${
                      reportReason === key
                        ? "border-red-500 bg-red-500/10 text-red-600"
                        : "border-border bg-secondary text-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        reportReason === key ? "border-red-500" : "border-muted-foreground/40"
                      }`}
                    >
                      {reportReason === key && (
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      )}
                    </span>
                    {t(key)}
                  </button>
                ))}
              </div>

              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={t("report.detailsPlaceholder")}
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-border bg-secondary p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />

              <button
                onClick={() => void submitReport()}
                disabled={reportSubmitting}
                className="mt-3 w-full rounded-2xl bg-gradient-to-l from-red-500 to-rose-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {reportSubmitting ? "..." : t("report.submit")}
              </button>

              <button
                onClick={() => setShowReport(false)}
                className="mt-2 w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
              >
                {t("detail.cancel")}
              </button>
            </div>
          </div>
        )}
        {showBooking && (
          <div
            className="absolute inset-0 z-[510] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in animate-duration-200"
            onClick={() => {
              if (!bookingSubmitting) setShowBooking(false);
            }}
          >
            <div
              className="w-full max-h-[92%] overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
              dir={dir}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/60" />
              {bookingSuccess ? (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-500">
                    <svg
                      className="h-8 w-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{t("booking.requestSent")}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("bookings.from")} {bookingRange?.from ? fmtDateLabel(bookingRange.from) : ""}{" "}
                    {t("bookings.to")} {bookingRange?.to ? fmtDateLabel(bookingRange.to) : ""}
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {formatPrice(bookingTotal, currency, locale)}{" "}
                    <span className="text-xs font-medium text-muted-foreground">
                      ({t("booking.nights", String(bookingNights))})
                    </span>
                  </p>
                  <div className="mt-3 w-full rounded-2xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{t("booking.pendingNote")}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span>{t("booking.requestRef")}</span>
                      <span className="font-bold text-foreground">{paymentRef}</span>
                    </div>
                  </div>
                  <div className="mt-5 w-full space-y-2">
                    <button
                      onClick={() => {
                        setShowBooking(false);
                        navigate({ to: "/bookings" });
                      }}
                      className="w-full rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
                    >
                      {t("booking.viewBookings")}
                    </button>
                    <button
                      onClick={() => setShowBooking(false)}
                      className="w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
                    >
                      {t("detail.cancel")}
                    </button>
                  </div>
                </div>
              ) : bookingSubmitting ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">{t("booking.processing")}</h3>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {formatPrice(bookingTotal, currency, locale)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("booking.demo")}</p>
                </div>
              ) : bookingStep === "payment" ? (
                <>
                  <h3 className="text-center text-lg font-bold text-foreground">
                    {t("booking.paymentMethod")}
                  </h3>
                  <p className="mt-1 mb-3 text-center text-xs text-muted-foreground">
                    {bookingRange?.from ? fmtDateLabel(bookingRange.from) : ""} —{" "}
                    {bookingRange?.to ? fmtDateLabel(bookingRange.to) : ""}
                  </p>

                  <div className="space-y-2 rounded-2xl bg-secondary/60 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("booking.daily")}</span>
                      <span className="font-bold text-foreground">
                        {formatPrice(house.price, currency, locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("booking.nights", String(bookingNights))}
                      </span>
                      <span className="font-bold text-foreground">
                        {formatPrice(bookingNights * house.price, currency, locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                      <span className="font-bold text-foreground">{t("booking.total")}</span>
                      <span className="text-lg font-extrabold text-primary">
                        {formatPrice(bookingTotal, currency, locale)}
                      </span>
                    </div>
                  </div>

                  {/* The card form was removed on purpose: collecting a PAN
                      and CVV in a client app violates PCI DSS and meant raw
                      card data was entering the app's memory and logs. Booking
                      now confirms server-side through create_booking(); a real
                      payment provider must be integrated before charging. */}
                  <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-foreground">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                      </svg>
                      {t("booking.card")}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t("booking.noCardData")}
                    </p>
                  </div>

                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    {t("booking.demo")}
                  </p>

                  <button
                    onClick={() => void handlePay()}
                    className="mt-3 w-full rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
                  >
                    {t("booking.requestBooking")}
                  </button>

                  <button
                    onClick={() => {
                      setBookingStep("dates");
                    }}
                    className="mt-2 w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
                  >
                    {t("detail.cancel")}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-center text-lg font-bold text-foreground">
                    {t("booking.title")}
                  </h3>
                  <p className="mt-1 mb-3 text-center text-xs text-muted-foreground">
                    {t("booking.selectDates")}
                  </p>

                  <div className="flex justify-center">
                    <Calendar
                      mode="range"
                      selected={bookingRange}
                      onSelect={setBookingRange}
                      disabled={{ before: new Date() }}
                      numberOfMonths={1}
                      className="w-fit"
                    />
                  </div>

                  {bookingRange?.from && bookingRange?.to && bookingNights > 0 && (
                    <div className="mt-4 space-y-2 rounded-2xl bg-secondary/60 p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t("booking.daily")}</span>
                        <span className="font-bold text-foreground">
                          {formatPrice(house.price, currency, locale)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t("booking.nights", String(bookingNights))}
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(bookingNights * house.price, currency, locale)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                        <span className="font-bold text-foreground">{t("booking.total")}</span>
                        <span className="text-lg font-extrabold text-primary">
                          {formatPrice(bookingTotal, currency, locale)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={goToPayment}
                    disabled={!bookingRange?.from || !bookingRange?.to || bookingNights <= 0}
                    className="mt-3 w-full rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    {t("booking.toPayment")}
                  </button>

                  <button
                    onClick={() => setShowBooking(false)}
                    className="mt-2 w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
                  >
                    {t("detail.cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
