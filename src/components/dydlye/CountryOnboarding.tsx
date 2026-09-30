import { useEffect, useState, useMemo } from "react";
import { worldCountries, type Country } from "@/data/worldCountries";
import { detectUserCountry } from "@/hooks/useUserCountry";
import { useSettings } from "@/i18n/useTranslation";

interface Props {
  onComplete: (country: Country) => void;
}

export function CountryOnboarding({ onComplete }: Props) {
  const { t, lang, dir } = useSettings();
  const [step, setStep] = useState<"detecting" | "confirm" | "pick">("detecting");
  const [detectedCountry, setDetectedCountry] = useState<Country | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await detectUserCountry();
      if (cancelled) return;
      if (result) {
        setDetectedCountry(result);
        setStep("confirm");
      } else {
        setStep("pick");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return worldCountries;
    const q = search.toLowerCase();
    return worldCountries.filter(
      (c) =>
        c.nameAr.includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.nameFr.toLowerCase().includes(q),
    );
  }, [search]);

  const countryName = (c: Country) => {
    if (lang === "ar") return c.nameAr;
    if (lang === "fr") return c.nameFr;
    return c.nameEn;
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-2xl shadow-lg">
            🌍
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-foreground">{t("onboarding.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
        </div>

        {step === "detecting" && (
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 shadow-lg">
            <svg
              className="h-10 w-10 animate-spin text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p className="text-sm font-semibold text-foreground">{t("onboarding.detecting")}</p>
          </div>
        )}

        {step === "confirm" && detectedCountry && (
          <div className="rounded-3xl bg-card p-6 shadow-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl">
                🌍
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {t("onboarding.detected")}
              </p>
              <p className="text-lg font-extrabold text-foreground">
                {countryName(detectedCountry)}
              </p>
              <div className="mt-4 flex w-full gap-3">
                <button
                  onClick={() => setStep("pick")}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition hover:bg-secondary"
                >
                  {t("onboarding.change")}
                </button>
                <button
                  onClick={() => onComplete(detectedCountry)}
                  className="flex-1 rounded-2xl bg-gradient-to-l from-primary to-primary-glow px-4 py-3 text-sm font-bold text-primary-foreground shadow-md transition active:scale-95"
                >
                  {t("onboarding.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "pick" && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-muted-foreground">{t("onboarding.pickTitle")}</p>
            <div className="relative">
              <svg
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("onboarding.search")}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 pr-10 text-sm text-foreground outline-none ring-primary/30 transition focus:ring-2"
              />
            </div>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-2xl bg-card p-2 shadow-inner">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  onClick={() => onComplete(c)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition hover:bg-primary/10 active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {c.code}
                  </span>
                  <span>{countryName(c)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("onboarding.noResults")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
