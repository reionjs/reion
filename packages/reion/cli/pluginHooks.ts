import type { ReionPlugin } from "../src/plugin/pluginAPI.js";

type HookName = keyof ReionPlugin;

type PluginHook = ((...args: unknown[]) => unknown | Promise<unknown>) | undefined;

export async function runPluginHook(
  plugins: ReionPlugin[] | undefined,
  hook: HookName,
  ...args: unknown[]
): Promise<void> {
  if (!plugins || plugins.length === 0) return;
  for (const plugin of plugins) {
    const fn = plugin[hook] as PluginHook;
    if (typeof fn === "function") {
      await fn(...args);
    }
  }
}

