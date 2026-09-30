import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminProperty } from "@/lib/adminApi";
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

function formatPrice(n: number) {
  return new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 0 }).format(n) + " درهم";
}

export function Properties() {
  const [items, setItems] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<AdminProperty | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, reportCounts: counts } = await adminApi.properties.list();
      setItems(data);
      setReportCounts(counts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل العقارات");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminApi.properties.removeDeep([toDelete.id]);
      toast.success("تم حذف العقار");
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
    (p) =>
      !needle ||
      p.title.toLowerCase().includes(needle) ||
      p.city.toLowerCase().includes(needle) ||
      (p.owner?.full_name ?? "").toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeader
        title="العقارات"
        subtitle={`${items.length} عقار`}
        action={
          <Link to="/properties/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة عقار
            </Button>
          </Link>
        }
      />

      <Input
        placeholder="ابحث بالعنوان أو المدينة أو اسم المضيف..."
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
          <EmptyState icon="🏠" title="لا توجد عقارات" hint="أضف عقاراً جديداً ليظهر في التطبيق" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <Card key={p.id} className="flex gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-sm font-extrabold text-foreground">{p.title}</h3>
                  {p.type && <Badge>{p.type}</Badge>}
                  {(reportCounts[p.id] ?? 0) > 0 && (
                    <Link
                      to="/reports"
                      title="بلاغات على هذا العقار"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 transition hover:bg-amber-500/25"
                    >
                      <Flag className="h-3 w-3" />
                      {reportCounts[p.id]}
                    </Link>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.city} — {p.location}
                </p>
                <p className="mt-1 text-xs font-bold text-primary">{formatPrice(p.price)}</p>
                {p.owner ? (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {p.owner.avatar_url ? (
                      <img
                        src={p.owner.avatar_url}
                        alt={p.owner.full_name ?? "صاحب العقار"}
                        className="h-4.5 w-4.5 rounded-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                    <span>
                      أضافه:{" "}
                      <span className="font-bold text-foreground">
                        {p.owner.full_name ?? "مستخدم غير معروف"}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    <span>أضافه بواسطة لوحة التحكم</span>
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Link to={`/properties/${p.id}`}>
                    <Button variant="secondary" className="h-8 px-3 text-xs">
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="h-8 px-3 text-xs"
                    onClick={() => setToDelete(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete != null}
        title="حذف العقار"
        message={`هل أنت متأكد من حذف "${toDelete?.title}"؟ سيختفي من التطبيق فوراً.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
