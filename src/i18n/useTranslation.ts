import { useCallback, useEffect, useState } from "react";
import {
  getTranslations,
  type Language,
  type Currency,
  LANG_KEY,
  CURRENCY_KEY,
  currencySymbols,
  direction,
} from "./translations";

const SETTINGS_CHANGE_EVENT = "dydlye-settings-change";

function readLanguage(): Language {
  const v = window.localStorage.getItem(LANG_KEY);
  return v === "ar" || v === "fr" || v === "en" ? v : "ar";
}

function readCurrency(): Currency {
  const v = window.localStorage.getItem(CURRENCY_KEY);
  if (!v) return "MAD";
  const valid: Currency[] = [
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
  return valid.includes(v as Currency) ? (v as Currency) : "MAD";
}

export function notifySettingsChange() {
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT));
}

export function useTranslation() {
  const [lang, setLang] = useState<Language>(readLanguage);

  useEffect(() => {
    const handler = () => setLang(readLanguage());
    window.addEventListener(SETTINGS_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handler);
  }, []);

  const t = useCallback(
    (key: string, ...args: string[]): string => {
      const trans = getTranslations(lang);
      const value = trans[key];
      if (value == null) return key;
      if (typeof value === "function") return value(...args);
      return value;
    },
    [lang],
  );

  const dir = direction[lang];
  const locale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US";

  return { lang, dir, locale, t };
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(readCurrency);

  useEffect(() => {
    const handler = () => setCurrencyState(readCurrency());
    window.addEventListener(SETTINGS_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handler);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    window.localStorage.setItem(CURRENCY_KEY, c);
    setCurrencyState(c);
    notifySettingsChange();
  }, []);

  return { currency, setCurrency };
}

export function useSettings() {
  const { lang, dir, locale, t } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  return { lang, dir, locale, t, currency, setCurrency };
}

const exchangeRates: Record<Currency, number> = {
  MAD: 1,
  USD: 0.1,
  EUR: 0.092,
  GBP: 0.079,
  EGP: 4.85,
  SAR: 0.375,
  AED: 0.367,
  TRY: 3.25,
  JPY: 14.8,
  CAD: 0.135,
  AUD: 0.152,
};

export function convertPrice(priceMAD: number, currency: Currency): number {
  return priceMAD * exchangeRates[currency];
}

export function formatPrice(priceMAD: number, currency: Currency, locale: string): string {
  const converted = convertPrice(priceMAD, currency);
  const symbol = currencySymbols[currency];
  const formatted = converted.toLocaleString(locale, {
    maximumFractionDigits: currency === "MAD" ? 0 : 2,
    minimumFractionDigits: currency === "MAD" ? 0 : 2,
  });
  return `${formatted} ${symbol}`;
}
