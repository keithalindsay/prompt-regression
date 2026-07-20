import { expect, test } from "vitest";
import { SCHEMA_VERSION } from "../src/schemas";

test("toolchain is wired", () => {
  expect(SCHEMA_VERSION).toBe(1);
});
