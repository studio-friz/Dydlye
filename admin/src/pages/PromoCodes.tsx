import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type PromoCode } from "@/lib/adminApi";
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

function formatDate(iso: string | null) {
  if (!iso) return "بدون صلاحية";
  return new Date(iso).toLocaleDateString("ar-MA");
}

export function PromoCodes() {
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.promo.list();
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل الأكواد");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (code: PromoCode) => {
    setTogglingId(code.id);
    try {
      await adminApi.promo.setActive(code.id, !code.is_active);
      toast.success(code.is_active ? "تم إيقاف الكود" : "تم تفعيل الكود");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminApi.promo.remove(toDelete.id);
      toast.success("تم حذف الكود");
      setToDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    (c) =>
      !needle ||
      c.code.toLowerCase().includes(needle) ||
      (c.description ?? "").toLowerCase().includes(needle),
  );
  const activeCount = items.filter((c) => c.is_active).length;

  return (
    <div>
      <PageHeader
        title="الخصومات"
        subtitle={`${items.length} كود • ${activeCount} نشط`}
        action={
          <Link to="/promo-codes/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة كود خصم
            </Button>
          </Link>
        }
      />

      <Input
        placeholder="ابحث بالكود أو الوصف..."
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
            icon="🎟️"
            title="لا توجد أكواد خصم"
            hint="أضف كود خصم جديد ليتمكن المستخدمون من استخدامه"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted-foreground">
                <th className="p-4 pb-3 font-bold">الكود</th>
                <th className="p-4 pb-3 font-bold">الخصم</th>
                <th className="p-4 pb-3 font-bold">الوصف</th>
                <th className="p-4 pb-3 font-bold">الاستخدامات</th>
                <th className="p-4 pb-3 font-bold">الصلاحية</th>
                <th className="p-4 pb-3 font-bold">الحالة</th>
                <th className="p-4 pb-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4" dir="ltr">
                    <span className="font-extrabold text-foreground">{c.code}</span>
                  </td>
                  <td className="p-4">
                    <Badge className="bg-primary/10 text-primary">{c.discount_percent}%</Badge>
                  </td>
                  <td className="max-w-[200px] truncate p-4 text-muted-foreground">
                    {c.description ?? "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {c.uses_count} / {c.max_uses ?? "∞"}
                  </td>
                  <td className="p-4 text-muted-foreground">{formatDate(c.expires_at)}</td>
                  <td className="p-4">
                    <Button
                      variant={c.is_active ? "secondary" : "outline"}
                      className="h-8 px-3 text-xs"
                      onClick={() => void handleToggle(c)}
                      disabled={togglingId === c.id}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {c.is_active ? "نشط" : "موقوف"}
                    </Button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1.5">
                      <Link to={`/promo-codes/${c.id}`}>
                        <Button variant="secondary" className="h-8 px-3 text-xs">
                          <Pencil className="h-3.5 w-3.5" />
                          تعديل
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        className="h-8 px-3 text-xs"
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={toDelete != null}
        title="حذف كود الخصم"
        message={`هل أنت متأكد من حذف كود "${toDelete?.code}"؟ لن يتمكن المستخدمون من استخدامه بعد الآن.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
