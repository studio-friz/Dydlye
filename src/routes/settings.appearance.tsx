import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/settings/appearance")({
  head: () => ({
    meta: [
      { title: "الوضع الداكن - Dydlye" },
      { name: "description", content: "اختيار مظهر التطبيق: فاتح، داكن، أو تلقائي حسب النظام." },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const { t } = useSettings();

  const modes: { key: ThemeMode; desc: string; icon: string }[] = [
    {
      key: "light",
      desc: t("settings.lightDesc"),
      icon: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
    },
    {
      key: "dark",
      desc: t("settings.darkDesc"),
      icon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    },
    {
      key: "system",
      desc: t("settings.systemDesc"),
      icon: "M2 5h20v12H2zM8 21h8M12 17v4",
    },
  ];

  return (
    <SettingsPage title={t("settings.appearancePage")} subtitle={t("settings.appearanceSubtitle")}>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {modes.map((m, i) => {
          const active = theme === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setTheme(m.key)}
              className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary ${
                i !== modes.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-gradient-to-br from-primary to-primary-glow text-white shadow-md"
                    : "bg-primary/10 text-primary"
                }`}
              >
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
                  <path d={m.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{t("theme." + m.key)}</div>
                <div className="text-xs text-muted-foreground">{m.desc}</div>
              </div>
              {active && (
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
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 px-1 text-center text-xs text-muted-foreground">{t("settings.saved")}</p>
    </SettingsPage>
  );
}
