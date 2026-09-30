import { NavLink } from "react-router-dom";
import { BarChart3, Building2, Flag, MapPin, Settings, TicketPercent, Users } from "lucide-react";
import { SignOutButton } from "@/pages/Login";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "الإحصائيات", icon: BarChart3, end: true },
  { to: "/destinations", label: "الوجهات", icon: MapPin },
  { to: "/properties", label: "العقارات", icon: Building2 },
  { to: "/users", label: "المستخدمون", icon: Users },
  { to: "/reports", label: "البلاغات", icon: Flag },
  { to: "/promo-codes", label: "الخصومات", icon: TicketPercent },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="flex h-dvh w-full overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-l border-border bg-surface-elevated/95 backdrop-blur">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-white border border-border p-0.5">
              <img src="/Dydlye.png" alt="Dydlye" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-foreground">Dydlye Admin</div>
              <div className="text-[10px] text-muted-foreground">لوحة التحكم</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition",
                  isActive
                    ? "bg-gradient-to-l from-primary to-primary-glow text-white shadow-md"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          ))}

          <NavLink
            to="#"
            onClick={(e) => e.preventDefault()}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-muted-foreground opacity-60 transition",
            )}
            title="قريباً"
          >
            <Settings className="h-4.5 w-4.5" />
            الإعدادات
            <span className="mr-auto rounded-full bg-secondary px-2 py-0.5 text-[10px]">
              قريباً
            </span>
          </NavLink>
        </nav>

        <div className="border-t border-border p-3">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
}
