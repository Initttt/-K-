import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Keep test browser profiles, downloads and screenshots within this project.
const tempDirectory = path.join(process.cwd(), ".cache", "browser-tmp");
mkdirSync(tempDirectory, { recursive: true });
process.env.TMPDIR = tempDirectory;
process.env.TMP = tempDirectory;
process.env.TEMP = tempDirectory;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright/report", open: "never" }]],
  outputDir: "output/playwright/test-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "chrome",
    timezoneId: "Asia/Shanghai",
    locale: "zh-CN",
    viewport: { width: 1440, height: 1080 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: { NEXT_TELEMETRY_DISABLED: "1", AI_ENABLED: "false" },
  },
});
