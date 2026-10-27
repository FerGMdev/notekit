"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/app/components/UserNav";

export default function DashboardNav({
  variant = "vertical",
}: {
  variant?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const horizontal = variant === "horizontal";

  return (
    <nav
      className={cn(
        horizontal
          ? "flex items-center gap-1 overflow-x-auto pb-1"
          : "grid items-start gap-2"
      )}
      aria-label="Dashboard"
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                "group flex items-center rounded-md font-medium transition-colors duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground",
                horizontal ? "whitespace-nowrap px-3 py-2 text-sm" : "px-3 py-2 text-lg",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "mr-2 text-primary",
                  horizontal ? "h-4 w-4" : "mr-4 h-6 w-6"
                )}
              />
              <span className={horizontal ? "inline" : "hidden md:inline-flex"}>
                {item.label}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
