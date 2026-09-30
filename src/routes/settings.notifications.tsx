import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { Switch } from "@/components/ui/switch";
import { useNotificationSettings, type NotificationSettings } from "@/hooks/useAppSettings";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات - Dydlye" },
      { name: "description", content: "إدارة إشعارات الحجوزات والعروض والرسائل في تطبيق Dydlye." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { settings, toggle } = useNotificationSettings();
  const { t } = useSettings();

  const items: { key: keyof NotificationSettings; label: string; desc: string; icon: string }[] = [
    {
      key: "bookings",
      label: t("notifLabel.bookings"),
      desc: t("notif.bookingsDesc"),
      icon: "M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
    },
    {
      key: "offers",
      label: t("notifLabel.offers"),
      desc: t("notif.offersDesc"),
      icon: "M3 11l18-8v18l-18-8M3 11v5M3 11l8 4",
    },
    {
      key: "messages",
      label: t("notifLabel.messages"),
      desc: t("notif.messagesDesc"),
      icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    },
    {
      key: "updates",
      label: t("notifLabel.updates"),
      desc: t("notif.updatesDesc"),
      icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
    },
  ];

  return (
    <SettingsPage title={t("notif.heading")} subtitle={t("notif.subtitle")}>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {items.map((it, i) => (
          <div
            key={it.key}
            className={`flex items-center gap-3 p-4 ${i !== items.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={it.icon} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{it.label}</div>
              <div className="text-xs text-muted-foreground">{it.desc}</div>
            </div>
            <Switch
              checked={settings[it.key]}
              onCheckedChange={() => toggle(it.key)}
              aria-label={it.label}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 px-1 text-center text-xs text-muted-foreground">{t("notif.saved")}</p>
    </SettingsPage>
  );
}
