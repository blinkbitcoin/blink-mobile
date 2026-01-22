import { Command } from "commander";
import {
  goHome,
  tapElement,
  tapAndWait,
  typeText,
  clearInput,
  hasElement,
  waitForElement,
  waitForAny,
  getUiHierarchy,
  getTestIds,
  pressBack,
  swipe,
  pause,
  fail,
} from "./appium.js";
import { collectUiInfo } from "../utils/xml-parser.js";
import { loadConfig } from "./config.js";
import { TIMEOUTS } from "./constants.js";

async function uxHome() {
  if (await goHome()) {
    console.log("Navigated to Home");
  } else {
    console.error("Could not navigate to home - may not be logged in");
  }
}

async function uxSettings() {
  if (!(await goHome())) fail("Could not navigate to home first");
  if (!(await tapElement("menu"))) fail("Could not find menu button");
  console.log("Opened Settings");
}

async function uxSend(destination: string, amount: string, opts: { wallet?: string; note?: string }) {
  console.log(`Sending ${amount} to ${destination}...`);

  if (!(await goHome())) fail("Could not navigate to home first");
  if (!(await tapAndWait("Send", "Username, invoice, or address"))) fail("Could not open Send screen");
  console.log("  [1/4] Opened send screen");

  await pause(300);
  await tapElement("Username, invoice, or address");
  await pause(200);
  await typeText(destination);
  await pause(500);

  if (!(await tapAndWait("Next", "Amount Input Button"))) fail("Could not proceed to amount screen");
  console.log("  [2/4] Destination set");

  await pause(300);
  await tapElement("Amount Input Button");
  await pause(300);

  for (const char of amount) {
    const key = char === "." ? "Key ." : `Key ${char}`;
    await tapElement(key, 100);
  }

  if (opts.wallet) {
    await tapElement("choose-wallet-to-send-from");
    await pause(300);
    const walletId = opts.wallet.toLowerCase() === "usd" ? "stablesats-balance" : "bitcoin-balance";
    await tapElement(walletId);
    await pause(300);
  }

  if (!(await tapAndWait("Set Amount", "Slide to Confirm"))) {
    if (await hasElement("icon-warning")) fail("Amount exceeds balance or invalid");
    fail("Could not proceed to confirmation");
  }
  console.log("  [3/4] Amount set");

  if (opts.note) {
    await tapElement("add-note");
    await pause(200);
    await typeText(opts.note);
    await pressBack();
    await pause(300);
  }

  console.log("  [4/4] Ready to send - use 'Slide to Confirm' to complete");
}

async function uxBackend(backend: string) {
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
  if (await hasElement("developer-screen-scroll-view")) {
    // Already on dev screen
  } else if (await hasElement("logo-button")) {
    await tapElement("logo-button", 80);
    await tapElement("logo-button", 80);
    await tapElement("logo-button", 80);
    if (!(await waitForElement("developer-screen-scroll-view", TIMEOUTS.short))) {
      fail("Could not open developer screen");
    }
  } else {
    fail("Not on entry screen - navigate there first");
  }
  console.log("  [1/3] On developer screen");

  // Step 2: Select backend (scroll if needed)
  if (!(await hasElement(buttonId))) {
    await swipe("up");
    await pause(300);
  }
  if (!(await tapElement(buttonId))) fail(`Could not find ${buttonId}`);
  console.log(`  [2/3] Selected ${backend}`);

  // Step 3: Save and go back
  await pause(200);
  if (!(await tapElement("Save Changes"))) fail("Could not find Save Changes button");
  await pause(300);
  await tapElement("Go back");
  console.log("  [3/3] Saved and exited");
}

async function uxLogin(opts: { phone?: string; code?: string; country?: string }) {
  const cfg = loadConfig().login;
  const phone = opts.phone || cfg.phone;
  const code = opts.code || cfg.code;
  const country = opts.country || cfg.country;

  if (!phone || !code) fail("Phone and code required - set in config.yaml or pass via flags");

  console.log(`Logging in with +${country} ${phone}...`);

  // Step 1: Navigate to SMS login screen
  if (await hasElement("home-screen")) fail("Already logged in");

  if (await hasElement("Login")) {
    await tapElement("Login");
    await waitForElement("SMS", TIMEOUTS.short);
  }
  if (await hasElement("SMS")) {
    await tapElement("SMS");
    await waitForElement("Use SMS", TIMEOUTS.short);
  }
  if (await hasElement("Use SMS")) {
    await tapElement("Use SMS");
  }

  if (!(await waitForElement("telephoneNumber", TIMEOUTS.short))) fail("Could not reach SMS login screen");
  console.log("  [1/4] On SMS login screen");

  // Step 2: Select country if specified
  if (country) {
    await tapElement("Country Picker");
    if (await waitForElement("text-input-country-filter", TIMEOUTS.short)) {
      await tapElement("text-input-country-filter");
      await clearInput();
      await typeText(country);
      await pause(500);

      // Find country testID (format: "Country Name (+code)")
      const testIds = await getTestIds();
      const countryId = testIds.find((id) => {
        const match = id.match(/^(.+?)\s*\(\+/);
        return match && match[1].toLowerCase() === country.toLowerCase();
      });
      if (countryId) {
        await tapElement(countryId);
      } else {
        console.log(`  [!] Country '${country}' not found, using default`);
        await pressBack();
      }
      await waitForElement("telephoneNumber", TIMEOUTS.short);
    }
  }

  // Step 3: Enter phone
  await tapElement("telephoneNumber");
  await clearInput();
  await typeText(phone);
  console.log("  [2/4] Phone entered");

  // Step 4: Send SMS and handle captcha
  await tapElement("Send via SMS");

  const start = Date.now();
  let captchaShown = false;

  while (Date.now() - start < TIMEOUTS.captcha) {
    const found = await waitForAny(
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
      await tapElement("permission_allow_button");
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
      const root = await getUiHierarchy();
      const items = root ? collectUiInfo(root) : [];
      const errText = items.find((i) => i.text && i.text.length > 20 && !i.id)?.text;
      fail(errText ? errText.slice(0, 60) : "Error after sending SMS");
    }
    if (captchaShown && !(await hasElement("Geetest"))) {
      console.log("  [OK] Captcha solved!");
      captchaShown = false;
    }
  }

  if (!(await hasElement("oneTimeCode")) && !(await hasElement("home-screen"))) fail("Code screen not shown");
  if (await hasElement("home-screen")) {
    console.log("  [4/4] SUCCESS: Logged in!");
    return;
  }
  console.log("  [3/4] Code screen ready");

  // Step 5: Enter code
  await tapElement("oneTimeCode");
  await typeText(code);

  const result = await waitForAny(["home-screen", "Geetest", "icon-warning", "permission_allow_button"], TIMEOUTS.medium);

  if (result === "Geetest") {
    console.log("  [!] Post-code captcha - please solve...");
    while (await hasElement("Geetest")) await pause(500);
    console.log("  [OK] Solved!");
  }

  if (await hasElement("permission_allow_button")) {
    await tapElement("permission_allow_button");
  }

  if (await waitForElement("home-screen", TIMEOUTS.short)) {
    console.log("  [4/4] SUCCESS: Logged in!");
  } else if (await hasElement("icon-warning")) {
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
