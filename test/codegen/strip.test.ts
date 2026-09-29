import { expect, test } from "bun:test";
import { gen } from "./helpers";

test("removes type annotations but keeps comments", () => {
  expect(gen(`// types incoming\nconst x: number = 1;`, { strip: true, comments: true }))
    .toMatchInlineSnapshot(`
      "// types incoming
      const x = 1;"
    `);
});

test("a statement list that strips to nothing leaves no blank line", () => {
  const source = [
    "function f() {",
    "  type T = number;",
    "}",
    "switch (x) {",
    "  case 1: type U = T;",
    "  case 2: g();",
    "  default: interface I {}",
    "}",
  ].join("\n");
  expect(gen(source, { strip: true })).toMatchInlineSnapshot(`
    "function f() {}
    switch (x) {
    case 1:
    case 2:
      g();
    default:
    }"
  `);
});
