import { docs } from 'collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { createElement } from 'react';
import type { Root, Node } from 'fumadocs-core/page-tree';
import type { LoaderPlugin } from 'fumadocs-core/source';
import type { ComponentType, SVGProps } from 'react';
import EnvIcon from '@/components/icons/env';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const CUSTOM_DOC_ICONS: Record<string, IconComponent> = {
  '/development-guide/environment-variables': EnvIcon,
};

function getCustomIconByUrl(url?: string): IconComponent | undefined {
  if (!url) return undefined;
  return Object.entries(CUSTOM_DOC_ICONS).find(([suffix]) => url.endsWith(suffix))?.[1];
}

function withCustomIcons(tree: Root): Root {
  function mapNode(node: Node): Node {
    if (node.type === 'page') {
      const Icon = getCustomIconByUrl(node.url);
      if (Icon) return { ...node, icon: createElement(Icon) };
      return node;
    }

    if (node.type === 'folder') {
      const IndexIcon = getCustomIconByUrl(node.index?.url);
      const index =
        IndexIcon && node.index
          ? { ...node.index, icon: createElement(IndexIcon) }
          : node.index;

      return {
        ...node,
        index,
        children: node.children.map(mapNode),
      };
    }

    return node;
  }

  return {
    ...tree,
    children: tree.children.map(mapNode),
  };
}

const customIconsPlugin: LoaderPlugin = {
  name: 'custom-icons',
  transformPageTree: {
    root(node) {
      return withCustomIcons(node);
    },
  },
};

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [
    lucideIconsPlugin(),
    customIconsPlugin,
  ],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.webp'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await (page.data as { getText: (kind: 'processed') => Promise<string> }).getText('processed');

  return `# ${page.data.title}

${processed}`;
}
