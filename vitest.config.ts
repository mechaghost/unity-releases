import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next preserves JSX for its own compiler; Vitest needs executable JSX.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
