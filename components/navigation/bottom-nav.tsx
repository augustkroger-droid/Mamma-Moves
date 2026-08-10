"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, ListChecks, ShieldCheck } from "lucide-react";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/intro", label: "Intro", icon: Home },
  { href: "/exercises", label: "Övningar", icon: Dumbbell },
  { href: "/workouts", label: "Pass", icon: ListChecks },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/stats", label: "Statistik", icon: BarChart3 }
];

export function BottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const visibleItems = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setIsAdmin(isAdminEmail(data.user?.email));
    }

    void loadUser();
  }, [supabase]);

  return (
    <nav className="bottom-nav" aria-label="Huvudnavigation">
      <div className="bottom-nav__inner" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              className="bottom-nav__link"
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
