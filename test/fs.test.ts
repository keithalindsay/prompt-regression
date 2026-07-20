import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCaseFiles, readTextIfExists } from "../src/util/fs";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-fs-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("readTextIfExists returns undefined for missing file", () => {
  expect(readTextIfExists(join(tmp(), "nope.txt"))).toBeUndefined();
});

test("findCaseFiles matches yaml/yml/json under ** recursively", () => {
  const root = tmp();
  mkdirSync(join(root, "cases", "nested"), { recursive: true });
  writeFileSync(join(root, "cases", "a.case.yaml"), "id: a");
  writeFileSync(join(root, "cases", "nested", "b.case.json"), "{}");
  writeFileSync(join(root, "cases", "ignore.txt"), "no");
  const found = findCaseFiles("cases/**/*.{yaml,yml,json}", root).sort();
  expect(found.map((f) => f.replace(root + "/", ""))).toEqual([
    "cases/a.case.yaml",
    "cases/nested/b.case.json",
  ]);
});
