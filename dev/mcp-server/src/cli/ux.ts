import { Command } from "commander";
import {
  adb,
  sleep,
  goHome,
  tapElement,
  tapAndWait,
  typeText,
  clearInput,
  hasElement,
  waitForElement,
  waitForAny,
  verifyScreen,
  getElementText,
  getUiHierarchy,
  collectTestIds,
  collectUiInfo,
} from "./helpers.js";
import { loadConfig } from "./config.js";
import { SWIPES, TIMEOUTS, fail } from "./constants.js";

function uxHome() {
  if (goHome()) {
    console.log("Navigated to Home");
  } else {
    console.error("Could not navigate to home - may not be logged in");
  }
}

function uxSettings() {
  if (!goHome()) fail("Could not navigate to home first");
  if (!tapElement("menu", true)) fail("Could not find menu button");
  console.log("Opened Settings");
}

function uxSend(destination: string, amount: string, opts: { wallet?: string; note?: string }) {
  console.log(`Sending ${amount} to ${destination}...`);

  if (!goHome()) fail("Could not navigate to home first");
  if (!tapAndWait("Send", "Username, invoice, or address")) fail("Could not open Send screen");
  console.log("  [1/4] Opened send screen");

  sleep(300);
  tapElement("Username, invoice, or address", true);
  sleep(200);
  typeText(destination, true);
  sleep(500);

  if (!tapAndWait("Next", "Amount Input Button")) fail("Could not proceed to amount screen");
  console.log("  [2/4] Destination set");

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
    if (hasElement("icon-warning")) fail("Amount exceeds balance or invalid");
    fail("Could not proceed to confirmation");
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
  const buttonIds: Record<string, string> = {
    local: "Local Button",
    main: "Main Button",
    staging: "Staging Button",
    custom: "Custom Button",
  };

  const buttonId = buttonIds[backend.toLowerCase()];
  if (!buttonId) fail(`Unknown backend: ${backend}. Use: staging, main, local, custom`);

  console.log(`Switching to ${backend} backend...`);

  // Step 1: Get to developer screen
  if (hasElement("developer-screen-scroll-view")) {
    // Already on dev screen
  } else if (hasElement("logo-button")) {
    tapElement("logo-button", true); sleep(80);
    tapElement("logo-button", true); sleep(80);
    tapElement("logo-button", true);
    if (!waitForElement("developer-screen-scroll-view", TIMEOUTS.short)) {
      fail("Could not open developer screen");
    }
  } else {
    fail("Not on entry screen - navigate there first");
  }
  console.log("  [1/3] On developer screen");

  // Step 2: Select backend (scroll if needed)
  if (!hasElement(buttonId)) {
    adb(SWIPES.up);
    sleep(300);
  }
  if (!tapElement(buttonId, true)) fail(`Could not find ${buttonId}`);
  console.log(`  [2/3] Selected ${backend}`);

  // Step 3: Save and go back
  sleep(200);
  if (!tapElement("Save Changes", true)) fail("Could not find Save Changes button");
  sleep(300);
  tapElement("Go back", true);
  console.log("  [3/3] Saved and exited");
}

function uxLogin(opts: { phone?: string; code?: string; country?: string }) {
  const cfg = loadConfig().login;
  const phone = opts.phone || cfg.phone;
  const code = opts.code || cfg.code;
  const country = opts.country || cfg.country;

  if (!phone || !code) fail("Phone and code required - set in config.yaml or pass via flags");

  console.log(`Logging in with +${country} ${phone}...`);

  // Step 1: Navigate to SMS login screen
  if (hasElement("home-screen")) fail("Already logged in");

  if (hasElement("Login")) {
    tapElement("Login", true);
    waitForElement("SMS", TIMEOUTS.short);
  }
  if (hasElement("SMS")) {
    tapElement("SMS", true);
    waitForElement("Use SMS", TIMEOUTS.short);
  }
  if (hasElement("Use SMS")) {
    tapElement("Use SMS", true);
  }

  if (!waitForElement("telephoneNumber", TIMEOUTS.short)) fail("Could not reach SMS login screen");
  console.log("  [1/4] On SMS login screen");

  // Step 2: Select country if specified
  if (country) {
    tapElement("Country Picker", true);
    if (waitForElement("text-input-country-filter", TIMEOUTS.short)) {
      tapElement("text-input-country-filter", true);
      clearInput();
      typeText(country, true);
      sleep(500);

      // Find country testID (format: "Country Name (+code)")
      const root = getUiHierarchy();
      if (root) {
        const testIds = collectTestIds(root);
        // Match exact country name before the "(+" part
        const countryId = testIds.find((id) => {
          const match = id.match(/^(.+?)\s*\(\+/);
          return match && match[1].toLowerCase() === country.toLowerCase();
        });
        if (countryId) {
          tapElement(countryId, true);
        } else {
          console.log(`  [!] Country '${country}' not found, using default`);
          adb("shell input keyevent KEYCODE_BACK");
        }
      }
      waitForElement("telephoneNumber", TIMEOUTS.short);
    }
  }

  // Step 3: Enter phone
  tapElement("telephoneNumber", true);
  clearInput();
  typeText(phone, true);
  console.log("  [2/4] Phone entered");

  // Step 4: Send SMS and handle captcha
  tapElement("Send via SMS", true);

  const start = Date.now();
  let captchaShown = false;

  while (Date.now() - start < TIMEOUTS.captcha) {
    const found = waitForAny(
      ["oneTimeCode", "home-screen", "Geetest", "icon-warning", "permission_allow_button"],
      2000
    );

    if (found === "oneTimeCode") break;
    if (found === "home-screen") {
      console.log("  [3/4] Logged in directly (local backend)");
      console.log("  [4/4] SUCCESS: Logged in!");
      return;
    }
    if (found === "permission_allow_button") {
      tapElement("permission_allow_button", true);
      continue;
    }
    if (found === "Geetest") {
      if (!captchaShown) {
        console.log("  [!] Captcha - please solve...");
        captchaShown = true;
      }
      continue;
    }
    if (found === "icon-warning") {
      // Try to get actual error text
      const root = getUiHierarchy();
      const items = root ? collectUiInfo(root) : [];
      const errText = items.find((i) => i.text && i.text.length > 20 && !i.id)?.text;
      fail(errText ? errText.slice(0, 60) : "Error after sending SMS");
    }
    if (captchaShown && !hasElement("Geetest")) {
      console.log("  [✓] Captcha solved!");
      captchaShown = false;
    }
  }

  if (!hasElement("oneTimeCode") && !hasElement("home-screen")) fail("Code screen not shown");
  if (hasElement("home-screen")) {
    console.log("  [4/4] SUCCESS: Logged in!");
    return;
  }
  console.log("  [3/4] Code screen ready");

  // Step 5: Enter code
  tapElement("oneTimeCode", true);
  typeText(code, true);

  const result = waitForAny(["home-screen", "Geetest", "icon-warning", "permission_allow_button"], TIMEOUTS.medium);

  if (result === "Geetest") {
    console.log("  [!] Post-code captcha - please solve...");
    while (hasElement("Geetest")) sleep(500);
    console.log("  [✓] Solved!");
  }

  if (hasElement("permission_allow_button")) {
    tapElement("permission_allow_button", true);
  }

  if (waitForElement("home-screen", TIMEOUTS.short)) {
    console.log("  [4/4] SUCCESS: Logged in!");
  } else if (hasElement("icon-warning")) {
    fail("Wrong code?");
  } else {
    console.log("  [4/4] Code entered - check screen");
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
