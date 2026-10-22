import type { CoreOptions } from "../core";

export const addons: CoreOptions["addons"] = {
  "darwin-arm64": () => new URL("./darwin-arm64.node", import.meta.url),
  "darwin-x64": () => new URL("./darwin-x64.node", import.meta.url),
  "linux-arm64": () => new URL("./linux-arm64.node", import.meta.url),
  "linux-x64": () => new URL("./linux-x64.node", import.meta.url),
  "win32-arm64": () => new URL("./win32-arm64.node", import.meta.url),
  "win32-x64": () => new URL("./win32-x64.node", import.meta.url),
};
