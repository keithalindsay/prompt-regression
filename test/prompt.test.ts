import { expect, test } from "vitest";
import { renderPrompt } from "../src/prompt";

test("substitutes variables in system and user prompts", () => {
  const r = renderPrompt({
    id: "greet",
    system: "You greet {{who}}.",
    prompt: "Say hi to {{who}} now.",
    input: { who: "Ada" },
  });
  expect(r.system).toBe("You greet Ada.");
  expect(r.user).toBe("Say hi to Ada now.");
});

test("coerces number/boolean inputs to strings", () => {
  const r = renderPrompt({
    id: "n",
    prompt: "count={{n}} flag={{f}}",
    input: { n: 3, f: true },
  });
  expect(r.user).toBe("count=3 flag=true");
});

test("throws on a referenced variable with no input", () => {
  expect(() =>
    renderPrompt({ id: "x", prompt: "Hi {{missing}}", input: {} }),
  ).toThrowError(/missing/);
});

test("no input map + no vars renders literally", () => {
  const r = renderPrompt({ id: "x", prompt: "plain text" });
  expect(r.user).toBe("plain text");
});
