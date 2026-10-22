import type { CoreOptions, Platform } from "./core";
import type { Backend } from "./read";
import { parseDialect } from "./wasm";

interface Binding {
  parse(source: string, flags: number): ArrayBuffer;
  analyze(source: string, flags: number): ArrayBuffer;
  dialect: string;
}

interface NodeProcess {
  platform?: string;
  arch?: string;
  dlopen?(module: { exports: unknown }, path: string): void;
}

interface DenoNamespace {
  permissions?: { querySync?(descriptor: { name: "ffi" }): { state: string } };
}

/** The addon in `addons` for this platform, or `null` where none loads. */
export function nativeBackend(addons: CoreOptions["addons"]): Backend | null {
  const process = (globalThis as { process?: NodeProcess }).process;
  if (addons === undefined || typeof process?.dlopen !== "function") return null;
  if (!ffiGranted()) return null;
  const module = { exports: {} as Partial<Binding> };
  try {
    const url = addons[`${process.platform}-${process.arch}` as Platform]?.();
    if (url?.protocol !== "file:") return null;
    process.dlopen(module, pathOf(url, process.platform === "win32"));
  } catch {
    return null;
  }
  const { parse, analyze, dialect } = module.exports;
  if (typeof parse !== "function" || typeof analyze !== "function") return null;
  const binding = { parse, analyze };
  return {
    dialect: typeof dialect === "string" ? parseDialect(dialect) : null,
    run: (entry, source, flags) => binding[entry](source, flags),
  };
}

function ffiGranted(): boolean {
  const deno = (globalThis as { Deno?: DenoNamespace }).Deno;
  if (deno === undefined) return true;
  try {
    return deno.permissions?.querySync?.({ name: "ffi" }).state === "granted";
  } catch {
    return false;
  }
}

function pathOf(url: URL, windows: boolean): string {
  const path = decodeURIComponent(url.pathname);
  if (!windows) return path;
  return url.host === "" ? path.slice(1) : `//${url.host}${path}`;
}
