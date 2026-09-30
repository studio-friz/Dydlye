import { useCallback, useEffect, useState } from "react";
import { Ban, Crown, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminProfile } from "@/lib/adminApi";
import { blockUserAndDeleteProperties, setUserBlocked } from "@/lib/admin-actions";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui";

export function Users() {
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toToggle, setToToggle] = useState<AdminProfile | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.users.list();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async () => {
    if (!toToggle) return;
    setToggling(true);

    if (toToggle.blocked) {
      const res = await setUserBlocked(toToggle.id, false);
      setToggling(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم إلغاء الحظر");
      setToToggle(null);
      void load();
      return;
    }

    const res = await blockUserAndDeleteProperties(toToggle.id);
    setToggling(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`تم حظر المستخدم وحذف ${res.deleted} عقار`);
    setToToggle(null);
    void load();
  };

  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    (u) =>
      !needle ||
      (u.full_name ?? "").toLowerCase().includes(needle) ||
      (u.phone ?? "").toLowerCase().includes(needle),
  );

  const blockedCount = items.filter((u) => u.blocked).length;

  return (
    <div>
      <PageHeader title="المستخدمون" subtitle={`${items.length} مستخدم • ${blockedCount} محظور`} />

      <Input
        placeholder="ابحث بالاسم أو رقم الهاتف..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="👤"
            title="لا يوجد مستخدمون"
            hint="سيظهر المستخدمون هنا بعد تسجيلهم في التطبيق"
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <Card
              key={u.id}
              className={`flex flex-wrap items-center gap-4 ${u.blocked ? "opacity-70" : ""}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-lg">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.full_name ?? "مستخدم"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-extrabold text-foreground">
                    {u.full_name ?? "بدون اسم"}
                  </h3>
                  {u.is_host && (
                    <Badge className="bg-amber-500/15 text-amber-600">
                      <Crown className="h-3 w-3" />
                      مضيف
                    </Badge>
                  )}
                  {u.blocked && (
                    <Badge className="bg-destructive/10 text-destructive">
                      <Ban className="h-3 w-3" />
                      محظور
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{u.phone ?? "بدون رقم هاتف"}</p>
              </div>
              {u.blocked ? (
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => setToToggle(u)}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  إلغاء الحظر
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="h-8 px-3 text-xs"
                  onClick={() => setToToggle(u)}
                >
                  <Ban className="h-3.5 w-3.5" />
                  حظر
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toToggle != null}
        title={toToggle?.blocked ? "إلغاء حظر المستخدم" : "حظر المستخدم"}
        message={
          toToggle?.blocked
            ? `هل أنت متأكد من إلغاء حظر "${toToggle?.full_name ?? "المستخدم"}"؟`
            : `هل أنت متأكد من حظر "${toToggle?.full_name ?? "المستخدم"}"؟ سيتم حذف جميع عقاراته نهائياً مع صورها وتعليقاتها وبلاغاتها، ولن يتمكن من استخدام التطبيق.`
        }
        confirmLabel={toToggle?.blocked ? "إلغاء الحظر" : "حظر"}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
        loading={toggling}
      />
    </div>
  );
}
