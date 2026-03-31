'use client';

import { useEffect, useMemo, useState } from 'react';
import Lottie from 'lottie-react';
import { getColors, colorify } from 'lottie-colorify';
import { useTheme } from 'next-themes';

/** Hex palette per theme (matches Reion light/dark). Using static hex so colors are reliable. */
const THEME_PALETTE = {
  light: {
    foreground: '#fafafa',
    muted: '#71717a',
    primary: '#ea580c',
    background: '#fafafa',
    accent: '#52525b',
  },
  dark: {
    foreground: '#fafafa',
    muted: '#a1a1aa',
    primary: '#fb923c',
    background: '#18181b',
    accent: '#71717a',
  },
} as const;

function getPalette(resolvedTheme: string | undefined) {
  return resolvedTheme === 'dark' ? THEME_PALETTE.dark : THEME_PALETTE.light;
}

export interface LottieSVGProps {
  /** Path to Lottie JSON in public (e.g. /reion-logo-animation.json). */
  src: string;
  className?: string;
  /** Width/height constraint (default 280). */
  size?: number;
  height?: number | string;
  width?: number | string;
  loop?: boolean;
  /** When true, Lottie colors are replaced with theme palette (primary, foreground, etc.). */
  applyTheme?: boolean;
}

export function LottieSVG({
  src,
  className,
  size = 280,
  loop = true,
  height,
  width,
  applyTheme = true,
}: LottieSVGProps) {
  const { resolvedTheme } = useTheme();
  const [rawData, setRawData] = useState<object | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRawData(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const themedData = useMemo(() => {
    if (!rawData) return null;
    try {
      const colors = getColors(rawData) as [number, number, number][];
      const palette = getPalette(resolvedTheme);
      const paletteArray = [
        palette.foreground,
        palette.muted,
        palette.primary,
        palette.background,
        palette.accent,
      ];
      const newColors = colors.map(
        (_, i) => paletteArray[i % paletteArray.length]
      );
      return colorify(newColors, rawData);
    } catch {
      return rawData;
    }
  }, [rawData, resolvedTheme]);

  if (loadError) return null;
  if (!themedData) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  // Key by theme so Lottie remounts and shows the correct light/dark colors
  const themeKey = resolvedTheme ?? 'light';

  return (
    <Lottie
      key={themeKey}
      animationData={applyTheme ? themedData : rawData}
      loop={loop}
      className={className}
      style={{ width: width ?? size, height: height ?? size }}
      aria-hidden
    />
  );
}
