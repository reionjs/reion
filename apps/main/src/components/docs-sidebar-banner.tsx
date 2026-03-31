import Link from 'next/link';

/**
 * Optional banner shown at the top of the docs sidebar.
 * Pass as sidebar.banner in DocsLayout.
 */
export function DocsSidebarBanner() {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-muted/50 px-3 py-2 text-sm text-fd-muted-foreground">
      <Link href="/" className="hover:text-fd-foreground font-medium">
        ← Back to home
      </Link>
    </div>
  );
}
