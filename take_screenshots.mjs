import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const artifactDir = "C:/Users/Mohsen/.gemini/antigravity/brain/52ae2127-2786-4559-bf77-10776aa814b8";
const localDir = "e:/Dev/Projects/Gridly/screenshots";

if (!fs.existsSync(localDir)) {
  fs.mkdirSync(localDir, { recursive: true });
}

async function capture(page, filename) {
  const artifactPath = path.join(artifactDir, filename);
  const localPath = path.join(localDir, filename);
  await page.screenshot({ path: artifactPath, fullPage: false });
  fs.copyFileSync(artifactPath, localPath);
  console.log(`  📸 Saved: ${filename}`);
}

async function run() {
  console.log("🚀 Launching Chromium for comprehensive page screenshots...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // 2x Retina clarity
  });
  const page = await context.newPage();

  try {
    console.log("1️⃣ Capturing Home / Landing Page (/)...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await capture(page, "01_home_landing_page.png");

    console.log("2️⃣ Capturing Login Page (/login)...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await capture(page, "02_login_page.png");

    console.log("3️⃣ Capturing Signup Page (/signup)...");
    await page.goto("http://localhost:5173/signup", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await capture(page, "03_signup_page.png");

    console.log("🔐 Logging in as Demo User (demo@gridly.app)...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "demo@gridly.app");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    console.log("⏳ Waiting for workspaces dashboard...");
    await page.waitForURL("**/workspaces**", { timeout: 15000 });
    await page.waitForTimeout(2000);

    console.log("4️⃣ Capturing Workspaces Dashboard (/workspaces)...");
    await capture(page, "04_workspaces_dashboard.png");

    console.log("5️⃣ Capturing Global Command Palette Modal (Cmd+K)...");
    await page.keyboard.press("Control+k");
    await page.waitForSelector(".cmd-k-modal", { timeout: 5000 });
    await page.waitForTimeout(800);
    await capture(page, "05_command_palette_modal.png");

    console.log("❌ Closing Command Palette...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    console.log("6️⃣ Capturing Specific Workspace Page (/w/demo-acme-corp)...");
    const acmeCard = page.locator("text=Acme Corp").first();
    await acmeCard.click();
    await page.waitForTimeout(2000);
    await capture(page, "06_acme_workspace_page.png");

    console.log("7️⃣ Capturing Specific Board View (/boards/:id - Q3 Product Roadmap)...");
    const roadmapCard = page.locator("text=Q3 Product Roadmap").first();
    await roadmapCard.click();
    await page.waitForTimeout(3000);
    await capture(page, "07_q3_roadmap_board_view.png");

    console.log("\n✅ All 7 pages/views captured successfully!");
    console.log("📁 Screenshots saved in:");
    console.log(`   • Project folder: ${localDir}`);
    console.log(`   • Brain artifact folder: ${artifactDir}`);
  } catch (err) {
    console.error("❌ Screenshot error:", err);
  } finally {
    await browser.close();
  }
}

run();
