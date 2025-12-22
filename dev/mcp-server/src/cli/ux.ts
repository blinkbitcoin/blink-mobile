import { Command } from "commander";
import {
  adb,
  sleep,
  goHome,
  tapElement,
  tapAndWait,
  typeText,
  hasElement,
  waitForElement,
  verifyScreen,
  getElementText,
} from "./helpers.js";
import { loadConfig } from "./config.js";

function uxHome() {
  if (goHome()) {
    console.log("Navigated to Home");
  } else {
    console.error("Could not navigate to home - may not be logged in");
  }
}

function uxSettings() {
  if (!goHome()) {
    console.error("Could not navigate to home first");
    process.exit(1);
  }
  if (!tapElement("menu", true)) {
    console.error("Could not find menu button");
    process.exit(1);
  }
  console.log("Opened Settings");
}

function uxSend(destination: string, amount: string, opts: { wallet?: string; note?: string }) {
  console.log(`Sending ${amount} to ${destination}...`);

  // Step 1: Go home and tap Send
  if (!goHome()) {
    console.error("Could not navigate to home first");
    process.exit(1);
  }
  if (!tapAndWait("Send", "Username, invoice, or address")) {
    console.error("Could not open Send screen");
    process.exit(1);
  }
  console.log("  [1/4] Opened send screen");

  // Step 2: Enter destination
  sleep(300);
  tapElement("Username, invoice, or address", true);
  sleep(200);
  typeText(destination, true);
  sleep(500);

  if (!tapAndWait("Next", "Amount Input Button")) {
    console.error("Could not proceed to amount screen - check destination");
    process.exit(1);
  }
  console.log("  [2/4] Destination set");

  // Step 3: Enter amount
  sleep(300);
  tapElement("Amount Input Button", true);
  sleep(300);

  for (const char of amount) {
    const key = char === "." ? "Key ." : `Key ${char}`;
    tapElement(key, true);
    sleep(100);
  }

  if (opts.wallet) {
    tapElement("choose-wallet-to-send-from", true);
    sleep(300);
    const walletId = opts.wallet.toLowerCase() === "usd" ? "stablesats-balance" : "bitcoin-balance";
    tapElement(walletId, true);
    sleep(300);
  }

  if (!tapAndWait("Set Amount", "Slide to Confirm")) {
    if (hasElement("icon-warning")) {
      console.error("Amount exceeds balance or invalid");
      process.exit(1);
    }
    console.error("Could not proceed to confirmation");
    process.exit(1);
  }
  console.log("  [3/4] Amount set");

  if (opts.note) {
    tapElement("add-note", true);
    sleep(200);
    typeText(opts.note, true);
    adb("shell input keyevent KEYCODE_BACK");
    sleep(300);
  }

  console.log("  [4/4] Ready to send - use 'Slide to Confirm' to complete");
}

function uxBackend(backend: string) {
  // Y coordinates for backend buttons after scroll (approximate)
  const backendCoords: Record<string, number> = {
    local: 1180,
    main: 1290,
    staging: 1400,
    custom: 1510,
  };

  const y = backendCoords[backend.toLowerCase()];
  if (!y) {
    console.error(`Unknown backend: ${backend}. Use: staging, main, local, custom`);
    process.exit(1);
  }

  console.log(`Switching to ${backend} backend...`);

  // Step 1: Verify on entry screen (one UI check)
  if (!hasElement("logo-button")) {
    console.error("Not on entry screen - navigate there first or logout");
    process.exit(1);
  }

  // Step 2: Tap logo 3x fast (use cached coordinates)
  adb("shell input tap 540 1235"); sleep(80);
  adb("shell input tap 540 1235"); sleep(80);
  adb("shell input tap 540 1235");
  sleep(400);
  console.log("  [1/3] Opened developer screen");

  // Step 3: Scroll and tap backend by coordinates
  adb("shell input swipe 540 1800 540 600 150");
  sleep(150);
  adb(`shell input tap 541 ${y}`);
  console.log(`  [2/3] Selected ${backend}`);

  // Step 4: Save (y~1056) and Go back (y~206)
  sleep(100);
  adb("shell input tap 541 1056"); // Save Changes
  sleep(150);
  adb("shell input tap 69 206");   // Go back
  console.log("  [3/3] Saved and exited");
}

function uxLogin(opts: { phone?: string; code?: string; country?: string }) {
  const cfg = loadConfig().login;
  const phone = opts.phone || cfg.phone;
  const code = opts.code || cfg.code;
  const country = opts.country || cfg.country;

  if (!phone || !code) {
    console.error("Phone and code required - set in config.yaml or pass via flags");
    process.exit(1);
  }

  console.log(`Logging in with +${country} ${phone}...`);

  // === STEP 1: Verify on entry screen ===
  if (!verifyScreen(["logo-button", "Login"], "Not on entry screen")) {
    if (hasElement("home-screen")) {
      console.error("Already logged in");
    }
    process.exit(1);
  }
  console.log("  [1/6] Verified: on entry screen");

  // === STEP 2: Navigate to SMS login ===
  tapElement("Login", true);
  if (!waitForElement("SMS", 5000)) {
    console.error("VERIFY FAILED: Login methods not shown");
    process.exit(1);
  }

  tapElement("SMS", true);
  if (!waitForElement("Use SMS", 3000)) {
    console.error("VERIFY FAILED: SMS option not shown");
    process.exit(1);
  }

  tapElement("Use SMS", true);
  if (!waitForElement("telephoneNumber", 5000)) {
    console.error("VERIFY FAILED: SMS login screen not shown");
    process.exit(1);
  }
  console.log("  [2/6] Verified: on SMS login screen");

  // === STEP 3: Select country ===
  tapElement("Country Picker", true);
  if (!waitForElement("text-input-country-filter", 3000)) {
    console.error("VERIFY FAILED: Country picker not open");
    process.exit(1);
  }

  tapElement("text-input-country-filter", true);
  sleep(200);
  typeText(country, true);
  sleep(500);

  // Verify country filter has our text
  const filterText = getElementText("text-input-country-filter");
  if (!filterText?.includes(country)) {
    console.error(`VERIFY FAILED: Country filter should contain '${country}', got '${filterText}'`);
    process.exit(1);
  }

  // Tap first result (the filtered country)
  adb("shell input tap 540 340");
  sleep(400);

  // Verify back on phone input screen (country picker closed)
  if (!waitForElement("Send via SMS", 3000)) {
    console.error("VERIFY FAILED: Not back on phone input after country select");
    process.exit(1);
  }
  console.log(`  [3/6] Verified: ${country} selected`);

  // === STEP 4: Enter phone number ===
  tapElement("telephoneNumber", true);
  sleep(200);
  typeText(phone, true);
  sleep(300);

  // Verify phone was entered
  const phoneText = getElementText("telephoneNumber");
  if (!phoneText?.includes(phone.slice(-4))) { // Check last 4 digits
    console.error(`VERIFY FAILED: Phone field should contain '${phone}', got '${phoneText}'`);
    process.exit(1);
  }
  console.log(`  [4/6] Verified: phone entered`);

  // === STEP 5: Send SMS and enter code ===
  tapElement("Send via SMS", true);

  // Wait for either code screen or captcha (up to 2 min for captcha solve)
  const timeout = 120000;
  const start = Date.now();
  let captchaShown = false;

  while (Date.now() - start < timeout) {
    sleep(500);

    if (hasElement("Geetest")) {
      if (!captchaShown) {
        console.log("  [!] Captcha detected - please solve it...");
        captchaShown = true;
      }
      continue;
    }

    if (captchaShown) {
      console.log("  [✓] Captcha solved!");
      captchaShown = false; // Reset so we don't print again
      sleep(500);
    }

    if (hasElement("oneTimeCode")) {
      break;
    }

    if (hasElement("icon-warning")) {
      console.error("VERIFY FAILED: Error shown - possibly rate limited");
      process.exit(1);
    }
  }

  if (!hasElement("oneTimeCode")) {
    console.error("VERIFY FAILED: Code entry screen not shown");
    process.exit(1);
  }
  console.log(`  [5/6] Verified: on code entry screen`);

  // Enter code
  tapElement("oneTimeCode", true);
  sleep(200);
  typeText(code, true);
  sleep(1500);

  // === STEP 6: Verify login success ===
  // Handle captcha after code entry
  if (hasElement("Geetest")) {
    console.log("  [!] Post-code captcha - please solve it...");
    const captchaTimeout = 120000;
    const start = Date.now();
    while (Date.now() - start < captchaTimeout) {
      sleep(1000);
      if (!hasElement("Geetest")) {
        console.log("  [✓] Captcha solved!");
        sleep(1000);
        break;
      }
    }
  }

  // Handle permission dialog
  if (hasElement("permission_allow_button")) {
    tapElement("permission_allow_button", true);
    sleep(800);
  }

  if (hasElement("home-screen")) {
    console.log("  [6/6] SUCCESS: Logged in!");
  } else if (hasElement("icon-warning")) {
    console.error("  [6/6] FAILED: Error shown - wrong code?");
    process.exit(1);
  } else {
    console.log("  [6/6] Code entered - check screen for next steps");
  }
}

export function registerUxCommands(program: Command) {
  const ux = program.command("ux").description("High-level UX flows");

  ux.command("home")
    .description("Navigate to home screen")
    .action(uxHome);

  ux.command("settings")
    .description("Open settings menu")
    .action(uxSettings);

  ux.command("send <destination> <amount>")
    .description("Send money (stops before final confirmation)")
    .option("-w, --wallet <type>", "Wallet to send from (btc|usd)")
    .option("-n, --note <text>", "Add a note/memo")
    .action(uxSend);

  ux.command("login")
    .description("Full SMS login (defaults from config.yaml)")
    .option("-p, --phone <number>", "Phone number")
    .option("-c, --code <code>", "Verification code")
    .option("--country <name>", "Country name")
    .action(uxLogin);

  ux.command("backend <name>")
    .description("Switch backend (staging|main|local|custom)")
    .action(uxBackend);
}
