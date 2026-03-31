import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { TopBar } from "@/components/top-bar";
import { DocsSidebar } from "@/components/docs-sidebar";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const options = baseOptions();
  const tree = source.getPageTree();
  return (
    <DocsLayout
      tree={tree}
      {...options}
      nav={{
        ...options.nav,
        component: <TopBar showSidebarTrigger />,
      }}
      sidebar={{
        enabled: true,
        collapsible: true,
        component: <DocsSidebar tree={tree} className="mt-14" />,
      }}
    >
      <div className="bg-background mt-14 flex h-[calc(var(--fd-docs-height)-var(--header-height))] flex-col gap-2 overflow-auto pb-8 lg:flex-row">
        {children}
      </div>
    </DocsLayout>
  );
}
