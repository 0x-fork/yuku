import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Core, parse, walk, type Platform } from "yuku";

// Yuku with src/parser/testing/dialect.zig compiled in, which test:dialect builds
const build = new URL("../../zig-out/dialect/", import.meta.url);
const wasm = new WebAssembly.Module(readFileSync(new URL("bin/yuku.wasm", build)));
const platform = `${process.platform}-${process.arch}` as Platform;
const addons = { [platform]: () => new URL(`native/${platform}.node`, build) };
const source = "each (item of items) { assert item |> f(%); }";

test("the addon loads with its dialect", () => {
  const dlopen = process.dlopen;
  let dialect: unknown;
  process.dlopen = function (module: { exports: { dialect?: unknown } }, path: string) {
    dlopen.call(this, module, path);
    dialect = module.exports.dialect;
  };
  try {
    expect(parse(source, { core: new Core({ wasm, addons }) }).diagnostics).toEqual([]);
  } finally {
    process.dlopen = dlopen;
  }
  expect(JSON.parse(dialect as string).files).toEqual([{ extension: ".jsx", lang: "jsx" }]);
});

for (const [backend, core] of [
  ["WebAssembly", new Core({ wasm })],
  ["the addon", new Core({ wasm, addons })],
] as const) {
  describe(`with ${backend}`, () => {

test("dialect nodes decode in the shapes their dialect declares", () => {
      const { program, diagnostics } = parse(source, { core });
      expect(diagnostics).toEqual([]);
      expect(program.body[0]).toMatchObject({
        type: "EachStatement",
        item: { type: "Identifier", name: "item" },
        list: { type: "Identifier", name: "items" },
        body: [
          {
            type: "AssertStatement",
            argument: {
              type: "PipelineExpression",
              operator: "|>",
              left: { type: "Identifier", name: "item" },
              right: { type: "CallExpression", arguments: [{ type: "TopicReference" }] },
            },
          },
        ],
      });
    });

    test("dialect nodes walk and analyze like standard ones", () => {
      const types: string[] = [];
      walk(parse(source, { core }).program, {
        enter(node) {
          types.push(node.type);
        },
      });
      expect(types).toEqual([
        "Program",
        "EachStatement",
        "Identifier",
        "Identifier",
        "AssertStatement",
        "PipelineExpression",
        "Identifier",
        "CallExpression",
        "Identifier",
        "TopicReference",
      ]);
      const file = parse(source, { core, semantic: true });
      expect(file.diagnostics).toEqual([]);
      const resolved = file.references.map((reference) => [
        reference.name,
        reference.binding?.name,
      ]);
      expect(resolved).toEqual([
        ["items", undefined],
        ["item", "item"],
        ["f", undefined],
      ]);
    });

    test("the dialect reads its own files, and others and a given lang parse as standard", () => {
      expect(parse(source, { core, path: "a.jsx" }).diagnostics).toEqual([]);
      expect(parse(source, { core, path: "a.js" }).diagnostics.length).toBeGreaterThan(0);
      expect(parse(source, { core, lang: "jsx" }).diagnostics.length).toBeGreaterThan(0);
    });
  });
}
