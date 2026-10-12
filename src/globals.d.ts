/** Platform the bundle was built for. Replaced with a string literal by esbuild's `define`. */
declare const __PLATFORM__: "tizen" | "webos" | "browser";

/** Stylesheets are bundled by esbuild. */
declare module "*.css";
