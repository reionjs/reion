"use client";

import Link from "fumadocs-core/link";
import type { Root, Node, Item, Folder } from "fumadocs-core/page-tree";
import { usePathname } from "next/navigation";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { cn } from "@/lib/utils";
import { DocsVersionDropdown } from "./docs-version-dropdown";
import {
  buildDocsHref,
  DocVersionUrl,
  parseDocsPathname,
} from "@/lib/docs-versions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  LucideIcon,
  XIcon,
} from "lucide-react";
import HOME_NAV from "@/lib/nav.config";
import { sidebar } from "@/lib/sidebar";
import { Button } from "./ui/button";

export interface DocsSidebarProps {
  tree: Root;
  className?: string;
}

function isHrefActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== "/docs" &&
      !/^\/docs\/v[^/]+$/.test(href) &&
      pathname.startsWith(href + "/"))
  );
}

function isItemActive(
  item: Item,
  pathname: string,
  currentVersion: string
): boolean {
  const href = buildDocsHref(item.url, currentVersion as DocVersionUrl);
  return isHrefActive(pathname, href);
}

function isNodeActive(
  node: Node,
  pathname: string,
  currentVersion: string
): boolean {
  if (node.type === "page") return isItemActive(node, pathname, currentVersion);
  if (node.type === "folder")
    return isFolderActive(node, pathname, currentVersion);
  return false;
}

function isFolderActive(
  folder: Folder,
  pathname: string,
  currentVersion: string
): boolean {
  if (folder.index && isItemActive(folder.index, pathname, currentVersion))
    return true;
  return folder.children.some((child) =>
    isNodeActive(child, pathname, currentVersion)
  );
}

function SidebarItem({
  item,
  depth = 0,
  onLinkClick,
  currentVersion,
}: {
  item: Item;
  depth?: number;
  onLinkClick?: () => void;
  currentVersion: string;
}) {
  const pathname = usePathname();
  const href = buildDocsHref(item.url, currentVersion as DocVersionUrl);
  const isActive =
    pathname === href ||
    (href !== "/docs" &&
      href !== `/docs/${currentVersion}` &&
      pathname.startsWith(href + "/"));
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onLinkClick}
      className={cn(
        "text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive && "bg-fd-primary/10 text-fd-primary font-medium"
      )}
      style={{ paddingInlineStart: `calc(0.75rem + ${depth * 0.75}rem)` }}
    >
      {Icon && (
        <span className="flex size-4 items-center justify-center">{Icon}</span>
      )}
      {item.name}
    </Link>
  );
}

function SidebarFolder({
  folder,
  depth = 0,
  onLinkClick,
  currentVersion,
}: {
  folder: Folder;
  depth?: number;
  onLinkClick?: () => void;
  currentVersion: string;
}) {
  const pathname = usePathname();
  const hasActiveChild = isFolderActive(folder, pathname, currentVersion);
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <Collapsible className="mt-2" open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-fd-muted-foreground flex w-full items-center justify-between">
        {folder.name && (
          <div
            className="px-3 py-1.5 text-xs font-semibold tracking-wider uppercase"
            style={{ paddingInlineStart: `calc(0.75rem + ${depth * 0.75}rem)` }}
          >
            {folder.name}
          </div>
        )}
        {open ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {folder.index && (
          <SidebarItem
            item={folder.index}
            depth={depth + 1}
            onLinkClick={onLinkClick}
            currentVersion={currentVersion}
          />
        )}
        {folder.children.map((node, i) => (
          <SidebarNode
            key={node.$id ?? i}
            node={node}
            depth={depth + 1}
            onLinkClick={onLinkClick}
            currentVersion={currentVersion}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarNode({
  node,
  depth = 0,
  onLinkClick,
  currentVersion,
}: {
  node: Node;
  depth?: number;
  onLinkClick?: () => void;
  currentVersion: string;
}) {
  if (node.type === "page") {
    return (
      <SidebarItem
        item={node}
        depth={depth}
        onLinkClick={onLinkClick}
        currentVersion={currentVersion}
      />
    );
  }
  if (node.type === "folder") {
    return (
      <SidebarFolder
        folder={node}
        depth={depth}
        onLinkClick={onLinkClick}
        currentVersion={currentVersion}
      />
    );
  }
  if (node.type === "separator") {
    return <hr className="border-fd-border my-2" />;
  }
  return null;
}

function SidebarTree({
  tree,
  onLinkClick,
  currentVersion,
}: {
  tree: Root;
  onLinkClick?: () => void;
  currentVersion: string;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Docs">
      {tree.children.map((node, i) => (
        <SidebarNode
          key={node.$id ?? i}
          node={node}
          depth={0}
          onLinkClick={onLinkClick}
          currentVersion={currentVersion}
        />
      ))}
    </nav>
  );
}

export function DocsSidebar({ tree, className }: DocsSidebarProps) {
  const open = useSyncExternalStore(
    sidebar.subscribe,
    () => sidebar.open,
    () => sidebar.open
  );
  const pathname = usePathname();
  const { version: currentVersion } = parseDocsPathname(pathname);
  const isDocsRoute = pathname.startsWith("/docs");

  return (
    <>
      {isDocsRoute && (
        <div
          data-sidebar-placeholder
          className={cn(
            "bg-sidebar sticky top-(--header-height) z-20 h-[calc(var(--fd-docs-height)-var(--header-height))] border-r [grid-area:sidebar] max-md:hidden md:w-[268px]",
            className,
            "top-(-var(--header-height))"
          )}
        >
          <aside
            id="nd-sidebar"
            className="border-fd-border bg-fd-card no-scrollbar absolute inset-y-0 inset-s-0 flex w-full flex-col overflow-y-auto border-e text-sm"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
              <DocsVersionDropdown className="mb-2 w-full justify-between" />
              <SidebarTree tree={tree} currentVersion={currentVersion} />
            </div>
          </aside>
        </div>
      )}
      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => sidebar.setOpen(false)}
          />
          <aside
            className="border-fd-border bg-fd-background fixed inset-y-0 inset-e-0 z-40 flex w-[85%] max-w-[380px] flex-col overflow-y-auto border-s p-4 shadow-lg md:hidden"
            aria-modal
            aria-label="Docs menu"
          >
            <div className="flex items-center justify-end pb-2">
              <Button variant="ghost" size="icon-sm" onClick={() => sidebar.setOpen(false)}>
                <XIcon />
              </Button>
            </div>
            <DocsVersionDropdown className="mb-2 w-full justify-between" />

            {HOME_NAV.map((item) => (
              <SidebarItem
                key={item.href}
                item={{
                  name: item.label,
                  url: item.href,
                  icon: <item.icon className="size-4" />,
                  type: "page",
                }}
                depth={0}
                onLinkClick={() => sidebar.setOpen(false)}
                currentVersion={""}
              />
            ))}

            <SidebarTree
              tree={tree}
              onLinkClick={() => sidebar.setOpen(false)}
              currentVersion={currentVersion}
            />
          </aside>
        </>
      )}
    </>
  );
}
