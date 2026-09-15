// Vitest (via Vite) provides import.meta.glob at runtime. This declaration
// lets the Convex tsconfig typecheck test helpers without vite/client types.
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
