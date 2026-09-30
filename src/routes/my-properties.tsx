import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/dydlye/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMyProperties } from "@/hooks/useMyProperties";
import { toast } from "sonner";
import { useSettings, formatPrice } from "@/i18n/useTranslation";

export const Route = createFileRoute("/my-properties")({
  head: () => ({
    meta: [
      { title: "عقاراتي - Dydlye" },
      { name: "description", content: "إدارة عقاراتك المعروضة للإيجار." },
    ],
  }),
  component: MyPropertiesPage,
});

function MyPropertiesPage() {
  const { t, dir, currency, locale } = useSettings();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const navigate = useNavigate();
  const {
    properties: myProperties,
    loading: propsLoading,
    deleteProperty,
  } = useMyProperties(user?.id);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProperty(id);
      toast.success(t("my.deleted"));
    } catch {
      toast.error(t("my.deleteError"));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      if (!user) {
        navigate({ to: "/auth" });
      } else if (profile && !profile.is_host) {
        navigate({ to: "/become-host" });
      }
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  if (authLoading || profileLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!user || !profile?.is_host) {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/account" })}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground hover:bg-muted transition"
            >
              <svg
                className="h-5 w-5 rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">{t("my.heading")}</h1>
              <p className="text-xs text-muted-foreground">{t("my.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/add-property" })}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition active:scale-95 hover:bg-primary-glow shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("my.addNew")}
          </button>
        </div>

        {/* Listings */}
        {propsLoading ? (
          <div className="flex h-64 items-center justify-center rounded-3xl bg-card shadow-sm border">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : myProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🏠</div>
            <h3 className="text-lg font-bold text-foreground">{t("my.empty")}</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">{t("my.emptyHint")}</p>
            <button
              onClick={() => navigate({ to: "/add-property" })}
              className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-primary-glow"
            >
              {t("my.firstProperty")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myProperties.map((prop) => (
              <div
                key={prop.id}
                className="relative overflow-hidden rounded-3xl bg-card border shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="h-28 w-full sm:w-28 shrink-0 overflow-hidden rounded-2xl bg-muted animate-in fade-in">
                    {prop.images && prop.images.length > 0 ? (
                      <img
                        src={prop.images[0]}
                        alt={prop.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-glow text-3xl text-white">
                        🏠
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <h3 className="truncate text-base font-bold text-foreground">{prop.title}</h3>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="truncate">{prop.city}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {prop.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-secondary pt-3 sm:border-0 sm:pt-0">
                      <span className="text-base font-extrabold text-primary">
                        {formatPrice(prop.price, currency, locale)}
                        <span className="text-[10px] font-medium text-muted-foreground">
                          /{t("card.month")}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {prop.bedrooms} {t("card.bedrooms")}
                        </span>
                        <span className="h-3 w-px bg-border" />
                        <span>
                          {prop.bathrooms} {t("card.bathrooms")}
                        </span>
                        <span className="h-3 w-px bg-border" />
                        <span>
                          {prop.area} {t("card.area")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-border">
                  <button
                    onClick={() => navigate({ to: "/edit-property/$id", params: { id: prop.id } })}
                    className="flex flex-1 items-center justify-center gap-2 py-3.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {t("my.edit")}
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => setConfirmDeleteId(prop.id)}
                    disabled={deletingId === prop.id}
                    className="flex flex-1 items-center justify-center gap-2 py-3.5 text-xs font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {deletingId === prop.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                    ) : (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                    {t("my.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDeleteId && (
          <div
            className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              dir={dir}
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{t("my.deleteConfirm")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("my.deleteWarning")}</p>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground hover:bg-muted transition"
                >
                  {t("detail.cancel")}
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={deletingId === confirmDeleteId}
                  className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-bold text-white hover:bg-destructive/90 transition disabled:opacity-50"
                >
                  {deletingId === confirmDeleteId ? t("my.deleting") : t("my.confirmDelete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
