import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCases, CaseError } from "../src/cases";
import { DEFAULT_CONFIG } from "../src/schemas";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cases-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("loads and validates yaml cases", () => {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Hi {{name}}\ninput:\n  name: Ada\n",
  );
  const cases = loadCases(DEFAULT_CONFIG, root);
  expect(cases).toHaveLength(1);
  expect(cases[0]!.id).toBe("hello");
});

test("duplicate ids throw CaseError", () => {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(join(root, "cases", "a.case.yaml"), "id: dup\nprompt: a");
  writeFileSync(join(root, "cases", "b.case.yaml"), "id: dup\nprompt: b");
  expect(() => loadCases(DEFAULT_CONFIG, root)).toThrow(CaseError);
});
