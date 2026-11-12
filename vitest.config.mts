import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@": src } },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.tsx"],
          setupFiles: ["tests/setup/dom.ts"],
          // Grows with the first component worth testing; an empty project is
          // not a failure while the storefront is still a placeholder.
          passWithNoTests: true,
        },
      },
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/db.ts"],
          pool: "forks",
          fileParallelism: false,
          testTimeout: 20_000,
          // The project is wired now so the first service test lands without a
          // config detour. Remove this once a test exists here.
          passWithNoTests: true,
        },
      },
    ],
  },
});
