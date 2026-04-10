"use client";

import Link from "next/link";
import {
  BookOpen,
  BrainCircuitIcon,
  FolderTreeIcon, Plug,
  RocketIcon,
  Search,
  Sidebar,
  type LucideIcon
} from "lucide-react";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { ThemeDropdown } from "@/components/theme-dropdown";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import Logo from "./icons/logo";
import HOME_NAV from "@/lib/nav.config";
import { usePathname } from "next/navigation";
import { sidebar } from "@/lib/sidebar";

function FumaSearchTrigger() {
  const { enabled, setOpenSearch, hotKey } = useSearchContext();
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      aria-label="Open search"
      className={cn(
        "md:border-border md:bg-muted/50 text-muted-foreground inline-flex h-9 max-w-56 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors md:w-full md:min-w-48 md:border",
        "md:hover:bg-muted md:hover:text-foreground md:hover:border-border/80",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden flex-1 text-left md:flex">Search</span>
      <span className="hidden shrink-0 items-center gap-0.5 md:flex">
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
  className?: string;
}

const DOCS_LINKS: Array<{
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "Introduction",
    description: "What Reion is, why it exists, and how to get started.",
    href: "/docs",
    icon: BookOpen,
  },
  {
    title: "Get Started",
    description: "Set up Reion and ship your first API route quickly.",
    href: "/docs/get-started",
    icon: RocketIcon,
  },
  {
    title: "Development Guide",
    description:
      "Learn about the development guide, including file-based routing, params, and route handlers.",
    href: "/docs/development-guide/folder-structure",
    icon: FolderTreeIcon,
  },
  {
    title: "Concepts",
    description:
      "Learn about the concepts of Reion, including request/response, validation, middleware, and plugins.",
    href: "/docs/concepts/plugin",
    icon: BrainCircuitIcon,
  },
  {
    title: "Plugins",
    description: "Extend Reion with official plugins and custom hooks.",
    href: "/docs/plugins/cron",
    icon: Plug,
  },
];

export function TopBar({ className }: TopBarProps) {
  const pathname = usePathname();
  const docsActive = pathname.startsWith("/docs");
  return (
    <header
      id="nd-subnav"
      data-transparent={false}
      className={cn(
        "sticky top-(--fd-docs-row-1) z-30 flex items-center justify-between gap-2 border-b ps-4 pe-2.5 backdrop-blur-sm transition-colors [grid-area:header]",
        "h-(--fd-header-height) min-h-14 md:min-h-14",
        "bg-fd-background/80",
        className
      )}
    >
      <nav
        className="flex shrink-0 items-center gap-4 pl-2 md:gap-8 md:pl-12"
        aria-label="Main"
      >
        <Logo />
        <div className="hidden items-center gap-2 md:flex">
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
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "h-auto bg-transparent px-2 py-1.5",
                    docsActive && "text-primary"
                  )}
                >
                  Docs
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-popover/95 rounded-xl border p-3 shadow-2xl backdrop-blur">
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {DOCS_LINKS.map((item) => (
                      <li key={item.href}>
                        <NavigationMenuLink href={item.href} className="w-full">
                          <item.icon className="text-muted-foreground group-hover:text-foreground mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0 space-y-1">
                            <span className="text-foreground block text-sm leading-none font-medium">
                              {item.title}
                            </span>
                            <span className="text-muted-foreground block max-w-80 text-sm leading-snug">
                              {item.description}
                            </span>
                          </span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </nav>
      <div className="flex items-center gap-2">
        <FumaSearchTrigger />
        <ThemeDropdown />
        <Button
          variant="ghost"
          size="icon-sm"
          className={"md:hidden"}
          onClick={() => sidebar.setOpen(!sidebar.open)}
        >
          <Sidebar />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>
    </header>
  );
}
