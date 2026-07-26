import { chromium } from "playwright-core";

const OUT = process.env.OUT ?? "/tmp/shot.png";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

if (process.env.DEMO === "1") {
  await page.click("text=Prova con il campione demo");
  // wait for Anna's structured reply + panel
  await page.waitForSelector("text=ESITO CONFORMITÀ", { timeout: 20000 });
  await page.waitForSelector("text=DATI ESTRATTI", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
if (process.env.SCROLL === "top") {
  await page.evaluate(() => {
    document.querySelector("[data-chat-scroll]")?.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
}
if (process.env.PAGE) {
  await page.goto(`http://localhost:3000${process.env.PAGE}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: OUT });
await browser.close();
console.log("saved", OUT);
