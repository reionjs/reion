import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function getEnvFiles(mode?: string): string[] {
  const normalizedMode = mode?.trim();
  if (!normalizedMode) return [".env", ".env.local"];
  return [
    ".env",
    ".env.local",
    `.env.${normalizedMode}`,
    `.env.${normalizedMode}.local`,
  ];
}

function stripInlineComment(value: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value.trimEnd();
}

function parseValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return stripInlineComment(trimmed).trim();
}

function parseEnvLine(line: string): [string, string] | null {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;

  const normalized = raw.startsWith("export ") ? raw.slice(7).trim() : raw;
  const eqIdx = normalized.indexOf("=");
  if (eqIdx <= 0) return null;

  const key = normalized.slice(0, eqIdx).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const valueRaw = normalized.slice(eqIdx + 1);
  return [key, parseValue(valueRaw)];
}

function loadEnvFile(absPath: string, initialEnvKeys: Set<string>) {
  const content = readFileSync(absPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    // Preserve externally provided env vars (shell/CI).
    if (initialEnvKeys.has(key)) continue;
    process.env[key] = value;
  }
}

export function loadEnv(cwd: string, mode?: string): void {
  const initialEnvKeys = new Set(Object.keys(process.env));
  for (const file of getEnvFiles(mode)) {
    const absPath = resolve(cwd, file);
    if (!existsSync(absPath)) continue;
    loadEnvFile(absPath, initialEnvKeys);
  }
}
