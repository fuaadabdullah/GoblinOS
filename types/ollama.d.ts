// This file intentionally left small and inert.
// The canonical, consolidated `ollama` shim lives in `types/shims.d.ts`.
// Keep this module declared (empty) so per-package tooling can import it
// without producing duplicate-type errors when `types/shims.d.ts` is loaded.
declare module "ollama" {}
