import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCheck, Flag, RotateCcw, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Report } from "@/lib/adminApi";
import { blockUserAndDeleteProperties, deletePropertiesDeep } from "@/lib/admin-actions";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";

type ReportStatus = "new" | "reviewed" | "resolved";

const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "جديد",
  reviewed: "تمت المراجعة",
  resolved: "تم الحل",
};

const STATUS_BADGE: Record<ReportStatus, string> = {
  new: "bg-destructive/10 text-destructive",
  reviewed: "bg-amber-500/15 text-amber-600",
  resolved: "bg-emerald-500/15 text-emerald-600",
};

const NEXT_ACTION: Record<ReportStatus, { label: string; next: ReportStatus }> = {
  new: { label: "تمت المراجعة", next: "reviewed" },
  reviewed: { label: "تم الحل", next: "resolved" },
  resolved: { label: "إعادة فتح", next: "new" },
};

const REASON_LABELS: Record<string, string> = {
  "report.wrongInfo": "معلومات خاطئة",
  "report.spam": "إعلان مزعج",
  "report.fake": "إعلان وهمي",
  "report.other": "سبب آخر",
};

function toStatus(s: string | null | undefined): ReportStatus {
  return s === "reviewed" || s === "resolved" ? s : "new";
}

export function Reports() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | ReportStatus>("");
  const [toDelete, setToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toDeleteProperty, setToDeleteProperty] = useState<Report | null>(null);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [toBlockOwner, setToBlockOwner] = useState<Report | null>(null);
  const [blockingOwner, setBlockingOwner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.reports.list();
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل البلاغات");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdvance = async (report: Report) => {
    const status = toStatus(report.status);
    const next = NEXT_ACTION[status].next;
    if (next === status) return;
    try {
      await adminApi.reports.setStatus(report.id, next);
      toast.success("تم تحديث حالة البلاغ");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشلت العملية");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminApi.reports.remove(toDelete.id);
      toast.success("تم حذف البلاغ");
      setToDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!toDeleteProperty) return;
    setDeletingProperty(true);
    const res = await deletePropertiesDeep([toDeleteProperty.property_id]);
    setDeletingProperty(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("تم حذف العقار مع كل ما يتعلق به");
    setToDeleteProperty(null);
    void load();
  };

  const handleBlockOwner = async () => {
    if (!toBlockOwner) return;
    const ownerId = toBlockOwner.property?.owner_id;
    if (!ownerId) {
      toast.error("هذا العقار ليس له مالك");
      setToBlockOwner(null);
      return;
    }
    setBlockingOwner(true);
    const res = await blockUserAndDeleteProperties(ownerId);
    setBlockingOwner(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`تم حظر صاحب العقار وحذف ${res.deleted} عقار`);
    setToBlockOwner(null);
    void load();
  };

  const filtered = items.filter(!filter ? () => true : (r) => toStatus(r.status) === filter);
  const newCount = items.filter((r) => toStatus(r.status) === "new").length;

  return (
    <div>
      <PageHeader
        title="البلاغات"
        subtitle={`${items.length} بلاغ • ${newCount} جديد`}
        action={
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "" | ReportStatus)}
            className="w-40"
          >
            <option value="">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="reviewed">تمت المراجعة</option>
            <option value="resolved">تم الحل</option>
          </Select>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="🚩"
            title="لا توجد بلاغات"
            hint="ستظهر بلاغات المستخدمين على العقارات هنا فور وصولها"
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const status = toStatus(r.status);
            const action = NEXT_ACTION[status];
            const reason = r.reason ? (REASON_LABELS[r.reason] ?? r.reason) : "";
            return (
              <Card key={r.id} className="flex flex-wrap items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
                  {r.reporter?.avatar_url ? (
                    <img
                      src={r.reporter.avatar_url}
                      alt={r.reporter.full_name ?? "مستخدم"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Flag className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/properties/${r.property_id}`}
                      className="truncate text-sm font-extrabold text-foreground hover:text-primary"
                    >
                      {r.property?.title ?? "عقار محذوف"}
                    </Link>
                    <Badge className={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    من: {r.reporter?.full_name ?? "مستخدم مجهول"}
                    {r.reporter?.phone ? ` • ${r.reporter.phone}` : ""} •{" "}
                    {new Date(r.created_at).toLocaleDateString("ar-MA")}
                  </p>
                  {reason && (
                    <p className="mt-1.5 text-xs font-bold text-foreground">السبب: {reason}</p>
                  )}
                  {r.details && (
                    <p className="mt-1 rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-foreground">
                      {r.details}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {action.next !== status && (
                      <Button
                        variant={status === "resolved" ? "secondary" : "primary"}
                        className="h-8 px-3 text-xs"
                        onClick={() => void handleAdvance(r)}
                      >
                        {status === "resolved" ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCheck className="h-3.5 w-3.5" />
                        )}
                        {action.label}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      className="h-8 px-3 text-xs"
                      onClick={() => setToDeleteProperty(r)}
                      disabled={deletingProperty}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف العقار
                    </Button>
                    {r.property?.owner_id && (
                      <Button
                        variant="destructive"
                        className="h-8 px-3 text-xs"
                        onClick={() => setToBlockOwner(r)}
                        disabled={blockingOwner}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        حظر صاحب العقار
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      className="h-8 px-3 text-xs"
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={toDelete != null}
        title="حذف البلاغ"
        message="هل أنت متأكد من حذف هذا البلاغ؟"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={toDeleteProperty != null}
        title="حذف العقار"
        message={`هل أنت متأكد من حذف العقار "${toDeleteProperty?.property?.title ?? ""}"؟ سيتم حذفه نهائياً مع صوره وتعليقاته وبلاغاته.`}
        onConfirm={handleDeleteProperty}
        onCancel={() => setToDeleteProperty(null)}
        loading={deletingProperty}
      />

      <ConfirmDialog
        open={toBlockOwner != null}
        title="حظر صاحب العقار"
        message={`هل أنت متأكد من حظر "${toBlockOwner?.property?.owner?.full_name ?? "صاحب العقار"}"؟ سيتم حذف جميع عقاراته نهائياً مع صورها وتعليقاتها وبلاغاتها.`}
        confirmLabel="حظر وحذف العقارات"
        onConfirm={handleBlockOwner}
        onCancel={() => setToBlockOwner(null)}
        loading={blockingOwner}
      />
    </div>
  );
}
