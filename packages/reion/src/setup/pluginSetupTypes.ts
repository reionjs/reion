import type {
  AddPluginToReionConfigInput,
  AddPluginToReionConfigResult,
} from "./addPluginToReionConfig.js";

/** Passed to a package's `setup` export when using `reion add -p <pkg>`. */
export type ReionPluginSetupContext = {
  cwd: string;
  /** npm package name passed to `reion add -p`. */
  packageName: string;
  /**
   * True when `reion add --skip-install` was used (no `bun add` / `npm install` for the plugin).
   * Setup still runs; plugins may log extra hints if CLI tools are missing from `node_modules`.
   */
  skipInstall?: boolean;
  /**
   * Patches `reion.config.ts`: merges imports and appends entries to `plugins`.
   * Only supports `reion.config.ts` (not `.js`).
   */
  addPluginToReionConfig: (
    input: Omit<AddPluginToReionConfigInput, "configFile"> & { configFile?: string },
  ) => Promise<AddPluginToReionConfigResult>;
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
};

export type ReionPluginSetupFn = (
  ctx: ReionPluginSetupContext,
) => void | Promise<void>;
