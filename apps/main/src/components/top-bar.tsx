"use client";

import Link from "next/link";
import { Search, Sidebar } from "lucide-react";
import { renderTitleNav } from "fumadocs-ui/layouts/shared";
import { SidebarTrigger } from "fumadocs-ui/components/sidebar/base";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { ThemeDropdown } from "@/components/theme-dropdown";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavOptions } from "fumadocs-ui/layouts/shared";
import Logo from "./icons/logo";
import HOME_NAV from "@/lib/nav.config";
import { usePathname } from "next/navigation";

function FumaSearchTrigger() {
  const { enabled, setOpenSearch, hotKey } = useSearchContext();
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      aria-label="Open search"
      className={cn(
        "border-border bg-muted/50 text-muted-foreground inline-flex h-9 w-full max-w-56 min-w-48 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        "hover:bg-muted hover:text-foreground hover:border-border/80",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <span className="flex shrink-0 items-center gap-0.5">
        {hotKey.map((k, i) => (
          <kbd
            key={i}
            className="border-border bg-background/80 rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
          >
            {k.display}
          </kbd>
        ))}
      </span>
    </button>
  );
}

export interface TopBarProps {
  showSidebarTrigger?: boolean;
  className?: string;
}

// const nav: NavOptions = {
//   enabled: true,
//   component: [
//   {
//     component: <Link href="/" className="text-sm text-fd-muted-foreground hover:text-fd-foreground px-2 py-1.5 rounded-md">Home</Link>,
//   },
//   {
//     component: <Link href="/docs" className="text-sm text-fd-muted-foreground hover:text-fd-foreground px-2 py-1.5 rounded-md">Docs</Link>,
//   },
// ],
// };

export function TopBar({ showSidebarTrigger = false, className }: TopBarProps) {
  const pathname = usePathname();
  return (
    <header
      id="nd-subnav"
      data-transparent={false}
      className={cn(
        "sticky top-(--fd-docs-row-1) z-30 flex items-center gap-2 border-b ps-4 pe-2.5 backdrop-blur-sm transition-colors [grid-area:header]",
        "h-(--fd-header-height) min-h-14 md:min-h-14",
        "bg-fd-background/80",
        className
      )}
    >
      {/* {renderTitleNav(nav, {
        className: 'inline-flex items-center gap-2.5 font-semibold shrink-0',
      })} */}
      <nav className="flex shrink-0 items-center gap-8 pl-12" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-2">
          {HOME_NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-foreground hover:text-primary rounded-md px-2 py-1.5 text-sm",
                  isActive && "text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="min-w-0 flex-1" />
      <FumaSearchTrigger />
      <ThemeDropdown />
      {showSidebarTrigger && (
        <SidebarTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "p-2 md:hidden"
          )}
        >
          <Sidebar />
        </SidebarTrigger>
      )}
    </header>
  );
}
