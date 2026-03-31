'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Heading, AlignLeft } from 'lucide-react';
import { useDocsSearch } from 'fumadocs-core/search/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const resultTypeIcon = {
  page: FileText,
  heading: Heading,
  text: AlignLeft,
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { search, setSearch, query } = useDocsSearch({ type: 'fetch' });
  const results = query.data !== 'empty' ? query.data : null;

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false);
      setSearch('');
      router.push(url);
    },
    [router, setSearch]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'p-2')}
        aria-label="Search docs"
      >
        <Search className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),24rem)] p-0"
        align="end"
        sideOffset={8}
      >
        <Command shouldFilter={false} className="rounded-lg border-0 shadow-none">
          <CommandInput
            placeholder="Search docs..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {query.isLoading ? 'Searching...' : search.trim() ? 'No results found.' : 'Type to search docs.'}
            </CommandEmpty>
            {results && results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((item) => {
                  const Icon = resultTypeIcon[item.type];
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item.url)}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex w-full items-center gap-2 font-medium">
                        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
                        {typeof item.content === 'string'
                          ? item.content
                          : Array.isArray(item.breadcrumbs) && item.breadcrumbs.length > 0
                            ? (typeof item.breadcrumbs[item.breadcrumbs.length - 1] === 'string'
                                ? item.breadcrumbs[item.breadcrumbs.length - 1]
                                : String(item.breadcrumbs[item.breadcrumbs.length - 1]))
                            : item.url}
                      </span>
                      {Array.isArray(item.breadcrumbs) &&
                        item.breadcrumbs.length > 0 &&
                        item.breadcrumbs.every((b): b is string => typeof b === 'string') && (
                          <span className="text-xs text-muted-foreground">
                            {item.breadcrumbs.join(' › ')}
                          </span>
                        )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
