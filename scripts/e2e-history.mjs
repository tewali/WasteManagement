// E2E: demo conversation -> page reload -> reopen from history dropdown.
import { chromium } from "playwright-core";

const OUT = process.env.OUT ?? "/tmp/e2e-history.png";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

await page.click("text=Prova con il campione demo");
await page.waitForSelector("text=ESITO CONFORMITÀ", { timeout: 20000 });
await page.waitForTimeout(1000); // let the persist call land

// Fresh page: history must survive the reload.
await page.reload({ waitUntil: "networkidle" });
await page.click('[title="Storico conversazioni"]');
await page.waitForSelector("text=Storico conversazioni", { timeout: 5000 });

const title = await page
  .locator("div.absolute >> ul >> li >> button >> span >> span")
  .first()
  .textContent();
console.log("history title:", title);
if (!/Bonifiche Ambientali Nord/.test(title ?? "") || !/17 09 03/.test(title ?? "")) {
  throw new Error("auto-title missing producer or CER: " + title);
}

await page.locator("ul >> li >> button").first().click();
await page.waitForSelector("text=ESITO CONFORMITÀ", { timeout: 10000 });
await page.waitForSelector("text=DATI ESTRATTI", { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT });
await browser.close();
console.log("history e2e ok, saved", OUT);
