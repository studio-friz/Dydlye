import { useCallback, useEffect, useState } from "react";

/* ---------- Notifications ---------- */

export type NotificationSettings = {
  bookings: boolean;
  offers: boolean;
  messages: boolean;
  updates: boolean;
};

const NOTIF_KEY = "dydlye-notifications";
const defaultNotifications: NotificationSettings = {
  bookings: true,
  offers: true,
  messages: true,
  updates: false,
};

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotifications);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIF_KEY);
      if (raw) setSettings({ ...defaultNotifications, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback((key: keyof NotificationSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      window.localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, toggle };
}
