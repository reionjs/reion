import { inspect } from "node:util";

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  return inspect(arg, {
    colors: true,
    depth: 8,
    compact: false,
    breakLength: 100,
    sorted: true,
  });
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => formatArg(arg)).join(" ");
}

export const appLogger = {
  info: (...args: unknown[]) => console.log(formatArgs(args)),
  warn: (...args: unknown[]) => console.warn(formatArgs(args)),
  error: (...args: unknown[]) => console.error(formatArgs(args)),
};