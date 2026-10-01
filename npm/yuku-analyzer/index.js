import { Analyzer } from "./analyzer.js";

export { Analyzer };
export { BindingFlags } from "./decode.js";

export function analyze(source, options = {}) {
  const { path = "input.js", ...rest } = options;
  return new Analyzer().setFile(path, source, rest);
}
