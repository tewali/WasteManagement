// Phase 3 end-to-end smoke:
//  staff  -> dashboard, movimenti (accept + registro), portale clienti
//  client -> portale upload + submission
//  staff  -> verifica rapida on the submission
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "/tmp/shots";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });
}

// ---- producer: submit a report through the portal --------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1366, height: 960 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await login(page, "m.rossi@bianchicostruzioni.example", "cliente-demo");
  await page.waitForURL(/portale/, { timeout: 15000 });
  console.log("producer landed on:", page.url());

  // Minimal valid PDF; extraction falls back to the R1 fixture offline.
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF",
  );
  await page.setInputFiles('input[type="file"]', {
    name: "rapporto-sondaggio-170903.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.fill("textarea", "Conferimento previsto la prossima settimana.");
  await page.click("text=Invia il rapporto");
  await page.waitForSelector("text=Rapporto inviato", { timeout: 30000 });
  await page.waitForSelector("text=In verifica", { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/p3-portale-cliente.png`, fullPage: true });
  console.log("producer submission ok");
  await page.context().close();
}

// ---- staff: dashboard, movimenti, portale clienti --------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1536, height: 1024 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await login(page, "a.parolini@vallispa.example", "valli-demo");

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Tonnellate accettate per mese", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/p3-dashboard.png`, fullPage: true });
  console.log("dashboard ok");

  await page.goto(`${BASE}/movimenti`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=FIR-SIM-2026-0013", { timeout: 15000 });
  await page.click("text=Accetta");
  await page.waitForSelector("span:text('Accettato')", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/p3-movimenti.png`, fullPage: true });
  await page.click('button:has-text("Registro cronologico")');
  await page.waitForSelector("th:has-text('Prog.')", { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/p3-registro.png` });
  console.log("movimenti + registro ok");

  await page.goto(`${BASE}/portale-clienti`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=rapporto-sondaggio-170903.pdf", { timeout: 15000 });
  await page.locator('button:has-text("Verifica rapida")').first().click();
  await page.waitForSelector("text=Verificato da", { timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/p3-portale-staff.png`, fullPage: true });
  console.log("staff verifica rapida ok");
  await page.context().close();
}

// ---- producer sees the esito ----------------------------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1366, height: 960 } });
  await login(page, "m.rossi@bianchicostruzioni.example", "cliente-demo");
  await page.waitForURL(/portale/, { timeout: 15000 });
  await page.waitForSelector("text=Esito PDF", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/p3-portale-esito.png`, fullPage: true });
  console.log("producer sees esito ok");
  await page.context().close();
}

await browser.close();
console.log("phase 3 e2e ok");
