import { TopBar } from "@/components/top-bar";
import { DocsSidebar } from "@/components/docs-sidebar";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/">) {
  const tree = source.getPageTree();
  return (
    <div>
      <TopBar />
      <DocsSidebar tree={tree} className="mt-14 md:hidden" />
      <div className="bg-background h-[calc(100svh-var(--header-height))] overflow-auto">
        {children}
      </div>
    </div>
  );
}
