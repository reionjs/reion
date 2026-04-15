import { TopBar } from "@/components/top-bar";
import { DocsSidebar } from "@/components/docs-sidebar";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/">) {
  const tree = source.getPageTree();
  return (
    <div className="relative h-svh overflow-auto">
      <TopBar />
      <DocsSidebar tree={tree} className="mt-14 md:hidden" />
      {children}
    </div>
  );
}
