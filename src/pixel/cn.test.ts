import { expect, test } from "bun:test";

import { cn } from "./cn";

type Arg = string | false | null | undefined;

test.each([
  ["empty", [] as Arg[], ""],
  ["one string", ["a"], "a"],
  ["two strings", ["a", "b"], "a b"],
  ["false skipped", ["a", false, "b"], "a b"],
  ["undefined/null skipped", ["a", undefined, null, "b"], "a b"],
  ["empty string skipped", ["", "kept"], "kept"],
] as const)("cn (%s)", (_label, args, expected) => {
  expect(cn(...args)).toBe(expected);
});
