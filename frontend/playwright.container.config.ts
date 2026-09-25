import { defineConfig } from "@playwright/test";
import demo from "./playwright.demo.config";

// Run only against a disposable Compose project: tests delete all its tasks.
export default defineConfig({
  ...demo,
  use: { ...demo.use, baseURL: "http://127.0.0.1:18002" },
  webServer: undefined,
});
