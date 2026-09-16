import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import development from "./playwright.config";

export default defineConfig({
  ...development,
  grep: /create, edit, cancel|review and edit an AI suggestion|missing-key fallback/,
  use: { ...development.use, baseURL: "http://127.0.0.1:18001" },
  webServer: {
    command: "uv run python frontend/tests/serve_demo.py",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: "http://127.0.0.1:18001/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
