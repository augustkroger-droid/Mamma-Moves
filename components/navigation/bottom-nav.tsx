"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, ListChecks } from "lucide-react";

const navItems = [
  { href: "/intro", label: "Intro", icon: Home },
  { href: "/exercises", label: "Ovningar", icon: Dumbbell },
  { href: "/workouts", label: "Pass", icon: ListChecks },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/stats", label: "Statistik", icon: BarChart3 }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Huvudnavigation">
      <div className="bottom-nav__inner">
        {navItems.map((item) => {
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
