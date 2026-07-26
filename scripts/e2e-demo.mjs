// Quick end-to-end smoke: demo load -> verify colA -> ask for colonna B via chat.
import { chromium } from "playwright-core";

const OUT = process.env.OUT ?? "/tmp/e2e.png";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

await page.click("text=Prova con il campione demo");
await page.waitForSelector("text=ESITO CONFORMITÀ", { timeout: 20000 });

await page.fill('input[placeholder="Fai una domanda tecnica..."]', "Verifica contro Tabella 5 colonna B");
await page.keyboard.press("Enter");
await page.waitForSelector("text=colonna B - siti ad uso commerciale e industriale", { timeout: 20000 });
await page.waitForTimeout(800);

const esiti = await page.locator("text=ESITO CONFORMITÀ").count();
console.log("esito blocks:", esiti);
if (esiti < 2) throw new Error("second verification not rendered");

await page.screenshot({ path: OUT });
await browser.close();
console.log("e2e ok, saved", OUT);
