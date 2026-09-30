import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/i18n/useTranslation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/settings/account")({
  head: () => ({
    meta: [{ title: "إعدادات الحساب - Dydlye" }],
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [packageName, setPackageName] = useState("com.example.app");
  const [transactionIdError, setTransactionIdError] = useState(false);
  const [packageNameError, setPackageNameError] = useState(false);
  const { t, dir } = useSettings();

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Account deletion is server-side only. The previous client-side cascade
      // deleted table by table and reported success even when several of those
      // deletes failed, which left half-deleted accounts behind (M-09). It is
      // also no longer possible: bookings, subscriptions and profiles are not
      // client-writable.
      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) {
        console.error("delete_my_account failed:", rpcError);
        throw new Error(rpcError.message || t("settingsAccount.deleteError"));
      }

      // Clear all local caches
      try {
        localStorage.removeItem("dydlye:properties-cache");
        localStorage.removeItem("dydlye:favorites");
      } catch {
        // ignore localStorage errors
      }

      await signOut();
      setDialogOpen(false);
      toast.success(t("settingsAccount.deleted"));
      navigate({ to: "/" });
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || t("settingsAccount.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPage title={t("settingsAccount.heading")} subtitle={t("settingsAccount.subtitle")}>
      <div className="mt-4 overflow-hidden rounded-3xl border border-destructive/20 bg-card shadow-sm">
        <div className="p-5">
          <h3 className="mb-2 text-base font-bold text-destructive">
            {t("settingsAccount.danger")}
          </h3>
          <p className="mb-5 text-sm text-muted-foreground">{t("settingsAccount.dangerDesc")}</p>
          <ul className="mb-6 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>{t("settingsAccount.list1")}</li>
            <li>{t("settingsAccount.list2")}</li>
            <li>{t("settingsAccount.list3")}</li>
            <li>{t("settingsAccount.list4")}</li>
          </ul>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <button
                disabled={deleting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3.5 text-sm font-bold text-destructive-foreground shadow-sm transition hover:bg-destructive/90 active:scale-95 disabled:opacity-50"
              >
                {deleting ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                  </svg>
                )}
                <span>{t("settingsAccount.deleteBtn")}</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent dir={dir}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settingsAccount.confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settingsAccount.confirmDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-start">
                <AlertDialogCancel className="rounded-xl">
                  {t("settingsAccount.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {t("settingsAccount.confirmDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SettingsPage>
  );
}
