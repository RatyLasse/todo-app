import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:15173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "uv run python frontend/tests/serve_backend.py",
      cwd: repositoryDirectory,
      url: "http://127.0.0.1:18000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --port 15173",
      cwd: frontendDirectory,
      env: { TODO_API_PROXY: "http://127.0.0.1:18000" },
      url: "http://127.0.0.1:15173",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
