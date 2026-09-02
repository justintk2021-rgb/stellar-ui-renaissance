/**
 * Captures real app UI screenshots for the marketing landing page.
 *
 * Usage:
 *   npm run screenshots:landing
 *   SCREENSHOT_BASE_URL=http://localhost:8081 npm run screenshots:landing
 *
 * With login (optional, for live data in shots):
 *   SCREENSHOT_EMAIL=you@example.com SCREENSHOT_PASSWORD=secret npm run screenshots:landing
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "src", "assets", "landing-screenshots");
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://localhost:8080";

async function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = await readFile(filePath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

await loadEnvFile(path.join(root, ".env"));
await loadEnvFile(path.join(root, ".env.screenshots"));

const email = process.env.SCREENSHOT_EMAIL;
const password = process.env.SCREENSHOT_PASSWORD;

const shots = [
  { name: "auth", path: "/auth" },
  { name: "dashboard", path: "/dashboard?preview=marketing&page=dashboard" },
  { name: "journal", path: "/dashboard?preview=marketing&page=journal" },
  { name: "playbook", path: "/dashboard?preview=marketing&page=playbook" },
  { name: "notebook", path: "/dashboard?preview=marketing&page=notebook" },
  {
    name: "settings-brokers",
    path: "/dashboard?preview=marketing&page=settings",
    settingsSection: "Broker Management",
  },
];

async function login(page) {
  if (!email || !password) return false;
  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45000 }).catch(() => null);
  return page.url().includes("/dashboard");
}

async function waitForApp(page) {
  await page.waitForTimeout(2500);
  const spinner = page.locator(".animate-spin");
  await spinner.first().waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const useLogin = email && password;
if (useLogin) {
  await login(page);
}

for (const shot of shots) {
  try {
    let url = `${baseUrl}${shot.path}`;
    if (useLogin && shot.path.includes("preview=marketing")) {
      url = `${baseUrl}${shot.path.replace("?preview=marketing&", "?").replace("preview=marketing", "")}`;
      if (!url.includes("page=")) url = url.replace("/dashboard", "/dashboard?");
    }
    if (useLogin && shot.path.startsWith("/dashboard") && !shot.path.includes("preview")) {
      // real session: map page query manually after goto
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForApp(page);

    if (shot.settingsSection) {
      await page.getByRole("button", { name: shot.settingsSection }).click({ timeout: 12000 });
      await page.waitForTimeout(1000);
    }

    const file = path.join(outDir, `${shot.name}.png`);
    await page.locator("main").first().screenshot({ path: file, type: "png" }).catch(async () => {
      await page.screenshot({ path: file, type: "png" });
    });
    console.log("Saved", file);
  } catch (err) {
    console.warn(`Failed ${shot.name}:`, err.message);
  }
}

await browser.close();
console.log("Done. Output:", outDir);
