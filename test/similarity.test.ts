import { expect, test } from "vitest";
import { tokenSetCosine } from "../src/util/similarity";

test("identical text scores 1", () => {
  expect(tokenSetCosine("hello there ada", "hello there ada")).toBeCloseTo(1, 5);
});

test("disjoint text scores 0", () => {
  expect(tokenSetCosine("alpha beta", "gamma delta")).toBeCloseTo(0, 5);
});

test("paraphrase scores in the middle", () => {
  const s = tokenSetCosine(
    "hello ada lovely to meet you",
    "hello ada wishing you a lovely day",
  );
  expect(s).toBeGreaterThan(0.2);
  expect(s).toBeLessThan(0.95);
});

test("empty vs empty is 1; empty vs non-empty is 0", () => {
  expect(tokenSetCosine("", "")).toBe(1);
  expect(tokenSetCosine("", "hi")).toBe(0);
});
