"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArchiveIcon, ChevronDown, PackageIcon } from "lucide-react";
import {
  DOC_VERSION_URL_SEGMENTS,
  DOC_VERSION_LABELS,
  DEFAULT_DOC_VERSION,
  parseDocsPathname,
  buildDocsUrl,
  type DocVersionUrl,
} from "@/lib/docs-versions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DocsVersionDropdown({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { version, docSegments } = parseDocsPathname(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (value: string) => {
    const newUrl = buildDocsUrl(value as DocVersionUrl, docSegments);
    router.push(newUrl);
  };

  // Defer dropdown until mount to avoid hydration mismatch from Base UI's generated IDs
  if (!mounted) {
    return (
      <div
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex items-center gap-1.5 font-normal",
          className
        )}
        aria-label="Documentation version"
      >
        <span>{DOC_VERSION_LABELS[DEFAULT_DOC_VERSION]}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex items-center gap-1.5 font-normal py-4",
          className
        )}
        aria-label="Documentation version"
      >
        <span className="flex items-center gap-1">
          {version === DEFAULT_DOC_VERSION ? (
            <span className="bg-primary/30 text-primary flex items-center justify-center rounded-md p-1">
              <PackageIcon />
            </span>
          ) : (
            <span className="text-foreground/80 flex items-center justify-center rounded-md p-1">
              <ArchiveIcon />
            </span>
          )}
          <span>{DOC_VERSION_LABELS[version] ?? version}</span>
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={version} onValueChange={handleChange}>
          {DOC_VERSION_URL_SEGMENTS.map((v, i) => (
            <DropdownMenuRadioItem key={v} value={v}>
              {i === 0 ? (
                <div className="bg-primary/30 text-primary flex items-center justify-center rounded-md p-1">
                  <PackageIcon />
                </div>
              ) : (
                <div className="text-foreground/80 flex items-center justify-center rounded-md p-1">
                  <ArchiveIcon />
                </div>
              )}
              {DOC_VERSION_LABELS[v]}
              {i === 0 && (
                <span className="text-foreground/80 text-xs">Latest</span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
