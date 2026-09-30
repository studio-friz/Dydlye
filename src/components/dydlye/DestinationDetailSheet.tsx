import { memo, useState, useRef, useEffect } from "react";
import type { Destination, DestinationCategory } from "@/data/destinations";
import { toast } from "sonner";
import { useSettings } from "@/i18n/useTranslation";
import { addToTrip, toggleComplete, getTrip, isTripComplete } from "@/lib/tripPlanner";

interface Props {
  destination: Destination;
  onClose: () => void;
  onGetDirections?: () => void;
  onTripComplete?: () => void;
}

const categoryColors: Record<DestinationCategory, string> = {
  مسبح: "from-sky-500 to-cyan-400",
  "معلم سياحي": "from-amber-500 to-orange-400",
  مقهى: "from-amber-800 to-amber-600",
  مطعم: "from-red-500 to-rose-400",
  حفلة: "from-fuchsia-500 to-pink-400",
  تسوق: "from-violet-500 to-purple-400",
  طبيعة: "from-emerald-500 to-green-400",
  ترفيه: "from-blue-500 to-indigo-400",
  شاطئ: "from-yellow-400 to-amber-300",
  رياضة: "from-lime-500 to-green-400",
  "حمام تقليدي": "from-stone-500 to-neutral-400",
};

export const DestinationDetailSheet = memo(function DestinationDetailSheet({
  destination,
  onClose,
  onGetDirections,
  onTripComplete,
}: Props) {
  const { t, dir } = useSettings();
  const [showContact, setShowContact] = useState(false);
  const tripState = useState(() => getTrip())[0];
  const inTrip = tripState.some((tr) => tr.id === destination.id);
  const tripItem = tripState.find((tr) => tr.id === destination.id);
  const isCompleted = tripItem?.completed ?? false;
  const [activeImg, setActiveImg] = useState(0);
  const [clean, setClean] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);

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

  const scrollToImage = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement;
    if (child) {
      el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const width = e.currentTarget.offsetWidth;
    const scrollLeft = e.currentTarget.scrollLeft;
    const index = Math.round(Math.abs(scrollLeft) / width);
    setActiveImg(index);
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative animate-slide-up flex h-dvh w-full flex-col overflow-hidden bg-card"
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
            {destination.images && destination.images.length > 0 ? (
              <>
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex h-full w-full snap-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {destination.images.map((img, i) => (
                    <div key={i} className="h-full w-full shrink-0 snap-center">
                      <img
                        src={img}
                        alt={`${destination.name} - ${i + 1}`}
                        loading="lazy"
                        draggable={false}
                        className={`h-full w-full ${clean ? "object-contain" : "object-cover"}`}
                      />
                    </div>
                  ))}
                </div>

                {!clean && destination.images.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        scrollToImage(
                          activeImg > 0 ? activeImg - 1 : destination.images!.length - 1,
                        )
                      }
                      className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur transition hover:bg-black/60 active:scale-90 sm:flex"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        scrollToImage(
                          activeImg < destination.images!.length - 1 ? activeImg + 1 : 0,
                        )
                      }
                      className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur transition hover:bg-black/60 active:scale-90 sm:flex"
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
                    <div className="absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
                      {destination.images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollToImage(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === activeImg ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div
                className={`h-full w-full bg-gradient-to-br ${categoryColors[destination.category]}`}
              />
            )}

            {!clean && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 pt-24 text-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sm font-bold">{destination.rating}</span>
                    {destination.reviews > 0 && (
                      <span className="text-xs opacity-90">({destination.reviews})</span>
                    )}
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    {destination.category}
                  </span>
                </div>
                <h2 className="mt-1.5 text-3xl font-extrabold leading-tight drop-shadow-md">
                  {destination.name}
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
                    {destination.city}
                  </span>
                  {destination.location && <span>• {destination.location}</span>}
                  {destination.opening_hours && <span>🕒 {destination.opening_hours}</span>}
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
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {t("dest.directions")}
                    </button>
                    {destination.phone && (
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
                        >
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l2.11-1.29a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                        </svg>
                        {t("dest.call")}
                      </button>
                    )}
                  </div>

                  {!inTrip ? (
                    <button
                      onClick={() => {
                        addToTrip(
                          destination.id,
                          destination.name,
                          destination.category,
                          destination.lat,
                          destination.lng,
                        );
                        toast.success("تمت الإضافة إلى الرحلة");
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/40 bg-amber-400/25 px-5 py-3 text-sm font-bold text-amber-100 shadow-lg backdrop-blur-md transition hover:bg-amber-400/35 active:scale-95"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      أضف إلى الرحلة
                    </button>
                  ) : isCompleted ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/40 bg-emerald-400/25 px-5 py-3 text-sm font-bold text-emerald-100 opacity-80 backdrop-blur-md">
                      <span>✅</span>
                      تمت الزيارة
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        toggleComplete(destination.id);
                        toast.success("تم إكمال الوجهة!");
                        if (isTripComplete()) {
                          onTripComplete?.();
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/40 bg-emerald-400/25 px-5 py-3 text-sm font-bold text-emerald-100 shadow-lg backdrop-blur-md transition hover:bg-emerald-400/35 active:scale-95"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      ✔️ تمت الزيارة
                    </button>
                  )}
                </div>
              </div>
            )}

            {!clean && (
              <button
                onClick={onClose}
                className="absolute end-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-black/70 active:scale-90"
                aria-label={t("dest.close")}
              >
                ✕
              </button>
            )}

            {clean && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur animate-in fade-in">
                اضغط مطولاً للعودة
              </div>
            )}
          </div>
        </div>

        {/* Contact Options Overlay */}
        {showContact && destination.phone && (
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
                {t("dest.contactOptions")}
              </h3>

              <div className="flex flex-col gap-3">
                <a
                  href={`tel:${destination.phone}`}
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
                    >
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l2.11-1.29a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{t("dest.phoneCall")}</div>
                    <div className="text-xs text-muted-foreground">{destination.phone}</div>
                  </div>
                </a>

                <a
                  href={getWhatsAppLink(destination.phone)}
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
                    <div className="font-bold text-sm">{t("dest.whatsapp")}</div>
                    <div className="text-xs text-muted-foreground">{t("detail.whatsappDesc")}</div>
                  </div>
                </a>

                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(destination.phone);
                      toast.success(t("dest.copySuccess"));
                    } catch {
                      toast.error(t("dest.copyFailed"));
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
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-sm">{t("dest.copyNumber")}</div>
                    <div className="text-xs text-muted-foreground">{t("detail.copyClipboard")}</div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowContact(false)}
                className="mt-4 w-full rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted cursor-pointer"
              >
                {t("dest.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
