import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/dydlye/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  useHostSubscription,
  HOST_SUBSCRIPTION_PRICE_MAD,
  HOST_SUBSCRIPTION_REGULAR_PRICE_MAD,
} from "@/hooks/useHostSubscription";
import { toast } from "sonner";
import { useSettings, formatPrice } from "@/i18n/useTranslation";
import type { Product } from "@capgo/native-purchases";

export const Route = createFileRoute("/become-host")({
  component: BecomeHostPage,
});

type PayStep = "info" | "processing" | "success";

function BecomeHostPage() {
  const { t, currency, locale } = useSettings();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, markHost } = useProfile(user?.id);
  const { billingAvailable, loadProduct, purchase, restore } = useHostSubscription();
  const navigate = useNavigate();
  const [step, setStep] = useState<PayStep>("info");
  const [product, setProduct] = useState<Product | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Update document title and meta on language change
  useEffect(() => {
    document.title = t("host.title");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("host.desc"));
  }, [t]);

  // Load the real product price from the store (Play requires dynamic prices)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await billingAvailable())) {
        if (alive) setPriceLoading(false);
        return;
      }
      try {
        const p = await loadProduct();
        if (alive) setProduct(p);
      } catch {
        // keep fallback price
      }
      if (alive) setPriceLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [billingAvailable, loadProduct]);

  const regularPrice = HOST_SUBSCRIPTION_REGULAR_PRICE_MAD;
  const finalPrice = product
    ? product.priceString
    : formatPrice(HOST_SUBSCRIPTION_PRICE_MAD, currency, locale);

  // Already a host on initial load → redirect
  useEffect(() => {
    if (!authLoading && !profileLoading && profile && profile.is_host && step === "info") {
      navigate({ to: "/my-properties" });
    }
  }, [authLoading, profileLoading, profile, navigate, step]);

  if (authLoading || profileLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!authLoading && !profileLoading && profile && profile.is_host && step === "info") {
    return null;
  }

  const handlePayment = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) return;

    setStep("processing");

    const result = await purchase(user.id);

    if (result.ok) {
      markHost(result.expires_at);
      setStep("success");
    } else {
      if (result.code === "cancel") {
        toast.info(t("host.purchaseCancelled"));
      } else if (result.code === "unsupported") {
        toast.error(t("host.purchaseUnsupported"));
      } else if (result.code === "network") {
        toast.error(t("host.purchaseNetwork"));
      } else {
        toast.error(t("host.activationError"));
      }
      setStep("info");
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setStep("processing");
    const result = await restore();
    if (result.ok) {
      markHost(result.expires_at);
      setStep("success");
    } else {
      toast.error(
        result.code === "unavailable" ? t("host.restoreNone") : t("host.activationError"),
      );
      setStep("info");
    }
  };

  /* ─── SUCCESS ───────────────────────────────────────────────── */
  if (step === "success") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-400/30" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg">
              <svg
                className="h-12 w-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">{t("host.success")}</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {t("host.successDesc")}
          </p>
          <div className="mt-8 flex flex-col gap-3 w-full">
            <button
              onClick={() => navigate({ to: "/add-property" })}
              className="w-full rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-white shadow-md transition hover:bg-primary-glow active:scale-95"
            >
              {t("host.addFirst")}
            </button>
            <button
              onClick={() => navigate({ to: "/my-properties" })}
              className="w-full rounded-2xl bg-secondary px-6 py-4 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              {t("host.manage")}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ─── PROCESSING ────────────────────────────────────────────── */
  if (step === "processing") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t("host.payment")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("host.paymentWait")}</p>
        </div>
      </AppShell>
    );
  }

  /* ─── INFO PAGE ─────────────────────────────────────────────── */
  if (step === "info") {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
          {/* Back */}
          <button
            onClick={() => navigate({ to: "/account" })}
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <svg
              className="h-4 w-4 rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {t("host.back")}
          </button>

          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-glow p-8 text-white shadow-xl text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_60%)]" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur text-3xl">
                🏠
              </div>
              <h1 className="text-2xl font-extrabold">{t("host.heading")}</h1>
              <p className="mt-2 text-sm opacity-90 leading-relaxed">{t("host.subtitle")}</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="mt-6 space-y-3">
            {[
              { icon: "✅", title: t("host.feature1"), desc: t("host.feature1Desc") },
              { icon: "📸", title: t("host.feature2"), desc: t("host.feature2Desc") },
              { icon: "📍", title: t("host.feature3"), desc: t("host.feature3Desc") },
              { icon: "✏️", title: t("host.feature4"), desc: t("host.feature4Desc") },
            ].map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-4 rounded-2xl bg-card border border-border p-4"
              >
                <div className="text-2xl shrink-0">{b.icon}</div>
                <div>
                  <div className="text-sm font-bold text-foreground">{b.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="mt-6 rounded-3xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              {t("host.fee")}
            </p>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground line-through mr-2">
                {formatPrice(regularPrice, currency, locale)}
              </span>
              <span className="text-5xl font-extrabold text-primary">
                {priceLoading ? "..." : finalPrice}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("host.oneTime")}</p>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3">
            <span className="text-base">▶</span>
            <p className="text-xs text-muted-foreground">{t("host.payGoogle")}</p>
          </div>

          <button
            onClick={handlePayment}
            disabled={priceLoading}
            className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-primary-glow active:scale-95 disabled:opacity-60"
          >
            {priceLoading ? t("host.checking") : t("host.activate", String(finalPrice))}
          </button>

          <button
            onClick={handleRestore}
            className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
          >
            {t("host.restore")}
          </button>
        </div>
      </AppShell>
    );
  }

  /* ─── PAYMENT (handled directly on activation) ──────────────── */
  return null;
}
