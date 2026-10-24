import { chromium } from "playwright";
import fs from "node:fs";

const out = "/tmp/desktop-perf-trace.json";

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const client = await context.newCDPSession(page);

await client.send("Performance.enable");
await client.send("Overlay.setShowFPSCounter", { show: true }).catch(() => undefined);

await page.goto("http://127.0.0.1:8080/dashboard?preview=marketing", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(4000);

await client.send("Tracing.start", {
  categories: [
    "devtools.timeline",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "blink.user_timing",
    "disabled-by-default-v8.cpu_profiler",
  ].join(","),
  transferMode: "ReportEvents",
});

const events = [];
client.on("Tracing.dataCollected", ({ value }) => {
  events.push(...value);
});

await page.mouse.move(400, 300);
for (let i = 0; i < 12; i++) {
  await page.mouse.move(400 + i * 80, 280 + (i % 3) * 40);
  await page.waitForTimeout(80);
}
await page.mouse.wheel(0, 600);
await page.waitForTimeout(400);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(400);
await page.getByRole("button", { name: /journal/i }).first().click().catch(() => undefined);
await page.waitForTimeout(800);
await page.getByRole("button", { name: /chart/i }).first().click().catch(() => undefined);
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /dashboard/i }).first().click().catch(() => undefined);
await page.waitForTimeout(800);

const done = new Promise((resolve) => client.once("Tracing.tracingComplete", resolve));
await client.send("Tracing.end");
await done;

const metrics = await client.send("Performance.getMetrics");
await browser.close();

const frames = [];
const paints = [];
const layouts = [];
const styles = [];
const recs = [];
const functions = [];

for (const ev of events) {
  const name = ev.name;
  const dur = (ev.dur || 0) / 1000;
  if (name === "BeginFrame" || name === "DrawFrame" || name === "FireAnimationFrame") {
    frames.push({ name, dur, ts: ev.ts, args: ev.args });
  }
  if (name === "Paint" || name === "Layerize" || name === "PaintSetup" || name === "CompositeLayers") {
    paints.push({ name, dur, ts: ev.ts });
  }
  if (name === "Layout" || name === "UpdateLayoutTree" || name === "ScheduleStyleRecalculation") {
    layouts.push({ name, dur, ts: ev.ts });
  }
  if (name === "RecalculateStyles") {
    styles.push({ name, dur, ts: ev.ts });
  }
  if (name === "FunctionCall" || name === "EvaluateScript" || name === "v8.compile") {
    functions.push({ name, dur, ts: ev.ts, fn: ev.args?.data?.functionName });
  }
  if (dur > 8) recs.push({ name, dur, ts: ev.ts, fn: ev.args?.data?.functionName || ev.args?.data?.url });
}

recs.sort((a, b) => b.dur - a.dur);
paints.sort((a, b) => b.dur - a.dur);
layouts.sort((a, b) => b.dur - a.dur);
styles.sort((a, b) => b.dur - a.dur);
functions.sort((a, b) => b.dur - a.dur);

const longFrames = recs.filter((r) => r.dur >= 16.7).slice(0, 15);
const top = recs.slice(0, 12);

const report = {
  viewport: "1920x1080",
  metrics: Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value])),
  eventCount: events.length,
  topExpensive: top,
  longFrames,
  topPaints: paints.slice(0, 5),
  topLayouts: layouts.slice(0, 5),
  topStyles: styles.slice(0, 5),
  topScripts: functions.slice(0, 5),
};

fs.writeFileSync("/tmp/desktop-perf-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
