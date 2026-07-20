import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function readTextIfExists(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

export function writeText(file: string, data: string): void {
  ensureDir(dirname(file));
  writeFileSync(file, data, "utf8");
}

/**
 * Minimal glob for our one supported shape:
 *   [prefixDir/]**\/*.{ext1,ext2,...}   or   [prefixDir/]*.{ext,...}
 * Returns absolute-ish paths joined against `cwd`.
 */
export function findCaseFiles(glob: string, cwd: string): string[] {
  const starStar = glob.includes("**");
  const extMatch = glob.match(/\{([^}]+)\}\s*$/);
  const exts = extMatch
    ? extMatch[1]!.split(",").map((e) => e.trim().replace(/^\./, ""))
    : ["yaml", "yml", "json"];
  const prefix = glob.split(/\*\*?/)[0]!.replace(/\/$/, "");
  const base = prefix ? join(cwd, prefix) : cwd;
  const out: string[] = [];
  walk(base, exts, starStar, out);
  return out;
}

function walk(dir: string, exts: string[], recurse: boolean, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (recurse) walk(full, exts, recurse, out);
    } else if (exts.some((e) => ent.name.endsWith("." + e))) {
      out.push(full);
    }
  }
}
