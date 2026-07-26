// User management e2e (Phase 3): admin creates an invite, the invitee
// registers through the link, the admin sees and manages the account; a
// non-admin gets neither the nav entry nor the page.
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

let inviteLink;

// ---- admin: create the invite ----------------------------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1536, height: 1024 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await login(page, "a.parolini@vallispa.example", "valli-demo");
  await page.goto(`${BASE}/utenti`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Utenti e accessi", { timeout: 15000 });

  await page.click('button:has-text("Invita")');
  await page.fill('input[placeholder="nome@azienda.it"]', "l.bruni@vallispa.example");
  await page.click('button:has-text("Genera link d\'invito")');
  const notice = await page.locator("p.break-all").textContent({ timeout: 15000 });
  inviteLink = notice.match(/https?:\/\/\S+/)?.[0];
  if (!inviteLink) throw new Error("invite link not found in notice: " + notice);
  console.log("invite created:", inviteLink);
  await page.screenshot({ path: `${SHOTS}/u1-utenti-invito.png`, fullPage: true });
  await page.context().close();
}

// ---- invitee: register through the link ------------------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1366, height: 960 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.goto(inviteLink, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Invito valido", { timeout: 15000 });
  await page.fill('input[placeholder="Mario Rossi"]', "Lucia Bruni");
  await page.fill('input[type="password"]', "password-lucia");
  await page.screenshot({ path: `${SHOTS}/u2-register-invito.png` });
  await page.click('button:has-text("Registrati")');
  await page.waitForURL((u) => !u.pathname.includes("register"), { timeout: 20000 });
  console.log("invitee registered, landed on:", page.url());
  // Operator: no "Utenti e accessi" in the sidebar, /utenti redirects home.
  const navItems = await page.locator("nav a").allTextContents();
  if (navItems.some((t) => t.includes("Utenti"))) throw new Error("non-admin sees Utenti nav");
  await page.goto(`${BASE}/utenti`, { waitUntil: "networkidle" });
  if (page.url().includes("/utenti")) throw new Error("non-admin reached /utenti");
  console.log("non-admin correctly locked out of user management");
  await page.context().close();
}

// ---- admin: sees the new account, invite marked used ------------------------
{
  const page = await (await browser.newContext()).newPage({ viewport: { width: 1536, height: 1024 } });
  await login(page, "a.parolini@vallispa.example", "valli-demo");
  await page.goto(`${BASE}/utenti`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Lucia Bruni", { timeout: 15000 });
  await page.waitForSelector("text=Inviti utilizzati o scaduti", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/u3-utenti-gestione.png`, fullPage: true });
  console.log("admin sees new account and consumed invite");
  await page.context().close();
}

await browser.close();
console.log("user management e2e ok");
