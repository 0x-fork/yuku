import { nativeBackend } from "./native";
import type { Backend } from "./read";
import { compile, wasmBackend } from "./wasm";

/** A platform as `${process.platform}-${process.arch}` names it. */
export type Platform =
  | "darwin-arm64"
  | "darwin-x64"
  | "linux-arm64"
  | "linux-x64"
  | "win32-arm64"
  | "win32-x64";

export interface CoreOptions {
  /** The core compiled to WebAssembly, as a module or in base64. */
  wasm: WebAssembly.Module | string;
  /**
   * The core compiled to a Node-API addon for each platform, as
   * `() => new URL("./native/darwin-arm64.node", import.meta.url)`, so bundlers find it.
   */
  addons?: Partial<Record<Platform, () => URL>>;
}

/**
 * Yuku's compiled Zig core, which `parse` and `Project` run. Its Node-API addon runs where one
 * loads, and its WebAssembly everywhere else.
 */
export class Core {
  private readonly options: CoreOptions;
  private native: Backend | null | undefined;
  private module: WebAssembly.Module | undefined;

  constructor(options: CoreOptions) {
    if (typeof options?.wasm !== "string" && !(options?.wasm instanceof WebAssembly.Module)) {
      throw new TypeError("`wasm` must be a WebAssembly.Module or base64");
    }
    this.options = options;
  }

  /** @internal */
  backend(): Backend {
    if (this.native === undefined) this.native = nativeBackend(this.options.addons);
    if (this.native !== null) return this.native;
    if (this.module === undefined) this.module = compile(this.options.wasm);
    return wasmBackend(this.module);
  }
}
