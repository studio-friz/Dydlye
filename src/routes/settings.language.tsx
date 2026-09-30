import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import {
  LANG_KEY,
  CURRENCY_KEY,
  languageNames,
  currencyLabels,
  currencySymbols,
  type Language,
  type Currency,
} from "@/i18n/translations";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/settings/language")({
  head: () => ({
    meta: [
      { title: "اللغة والمنطقة - Dydlye" },
      { name: "description", content: "اختيار لغة التطبيق والمنطقة والعملة في Dydlye." },
    ],
  }),
  component: LanguagePage,
});

const languages: Language[] = ["ar", "fr", "en"];
const currencies: Currency[] = [
  "MAD",
  "USD",
  "EUR",
  "GBP",
  "EGP",
  "SAR",
  "AED",
  "TRY",
  "JPY",
  "CAD",
  "AUD",
];

function CheckMark() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
      <svg
        width="13"
        height="13"
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
  );
}

function LanguagePage() {
  const { t, lang, currency, setCurrency } = useSettings();

  const setLanguage = (l: Language) => {
    window.localStorage.setItem(LANG_KEY, l);
    window.location.reload();
  };

  const handleSetCurrency = (c: Currency) => {
    window.localStorage.setItem(CURRENCY_KEY, c);
    setCurrency(c);
  };

  return (
    <SettingsPage title={t("lang.heading")} subtitle={t("lang.subtitle")}>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("lang.language")}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {languages.map((l, i) => (
          <button
            key={l}
            onClick={() => setLanguage(l)}
            className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary ${
              i !== languages.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-extrabold text-primary">
              {l === "ar" ? "ع" : l === "fr" ? "Fr" : "En"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{languageNames[l]}</div>
              <div className="text-xs text-muted-foreground">
                {l === "ar" ? "العربية" : l === "fr" ? "Français" : "English"}
              </div>
            </div>
            {lang === l && <CheckMark />}
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("lang.currencyLabel")}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {currencies.map((c, i) => (
          <button
            key={c}
            onClick={() => handleSetCurrency(c)}
            className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary ${
              i !== currencies.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-extrabold text-primary">
              {currencySymbols[c]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{currencyLabels[c]}</div>
            </div>
            {currency === c && <CheckMark />}
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-6 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("lang.region")}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
            🌍
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{t("lang.region")}</div>
          </div>
          <CheckMark />
        </div>
      </div>

      <p className="mt-4 px-1 text-center text-xs text-muted-foreground">{t("lang.future")}</p>
    </SettingsPage>
  );
}
