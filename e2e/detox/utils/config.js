import { config } from "dotenv";
import path from "path";
config({ path: path.join(__dirname, "../../../dev/.env.tmp.ci") });
if (!process.env.ALICE_PHONE || !process.env.BOB_PHONE) {
    throw new Error("Development environment environment configuration is incorrect");
}
export var timeout = 10000;
export var otp = process.env.GALOY_STAGING_GLOBAL_OTP || "000000";
export var ALICE_PHONE = process.env.ALICE_PHONE;
export var ALICE_TOKEN = process.env.ALICE_TOKEN || "";
export var ALICE_USERNAME = process.env.ALICE_USERNAME || "";
export var ALICE_EMAIL = process.env.ALICE_USERNAME + "@galoy.io";
export var BOB_PHONE = process.env.BOB_PHONE;
export var BOB_TOKEN = process.env.BOB_TOKEN || "";
export var BOB_USERNAME = process.env.BOB_USERNAME || "";
export var BOB_EMAIL = process.env.BOB_USERNAME + "@galoy.io";
//# sourceMappingURL=config.js.map