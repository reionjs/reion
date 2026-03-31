import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { TopBar } from "@/components/top-bar";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <div>
      <TopBar />
      {children}
    </div>
  );
}
