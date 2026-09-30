import { useCallback, useEffect, useState } from "react";
import { worldCountries, findCountryByCoords, type Country } from "@/data/worldCountries";

const FIRST_LOGIN_KEY = "dydlye_first_login_done";
const COUNTRY_CODE_KEY = "dydlye_visited_country";

export function useUserCountry() {
  const [country, setCountryState] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = localStorage.getItem(COUNTRY_CODE_KEY);
    if (code) {
      const found = worldCountries.find((c) => c.code === code);
      if (found) setCountryState(found);
    }
    setLoading(false);
  }, []);

  const setCountry = useCallback((c: Country) => {
    localStorage.setItem(COUNTRY_CODE_KEY, c.code);
    setCountryState(c);
  }, []);

  const isFirstLogin = !localStorage.getItem(FIRST_LOGIN_KEY);

  const markFirstLoginDone = useCallback(() => {
    localStorage.setItem(FIRST_LOGIN_KEY, "true");
  }, []);

  return { country, setCountry, loading, isFirstLogin, markFirstLoginDone };
}

export async function detectUserCountry(): Promise<Country | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const country = findCountryByCoords(latitude, longitude);
        resolve(country);
      },
      () => {
        resolve(null);
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  });
}
