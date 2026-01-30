export var WHATSAPP_CONTACT_NUMBER = "+50369835117";
export var CONTACT_EMAIL_ADDRESS = "support@blink.sv";
export var APP_STORE_LINK = "https://apps.apple.com/app/blink-bitcoin-beach-wallet/id1531383905";
export var PLAY_STORE_LINK = "https://play.google.com/store/apps/details?id=com.galoyapp";
export var PREFIX_LINKING = [
    "https://pay.mainnet.galoy.io",
    "https://pay.bbw.sv",
    "https://pay.blink.sv",
    "bitcoinbeach://",
    "blink://",
];
// FIXME this should come from globals.lightningAddressDomainAliases
export var LNURL_DOMAINS = ["blink.sv", "pay.blink.sv", "pay.bbw.sv"];
export var getInviteLink = function (_username) {
    var username = _username ? "/".concat(_username) : "";
    return "https://get.blink.sv".concat(username);
};
export var BLINK_DEEP_LINK_PREFIX = "blink:/";
export var TELEGRAM_CALLBACK_PATH = "auth/passport-callback";
export var HIDDEN_AMOUNT_PLACEHOLDER = "****";
export var APPROXIMATE_PREFIX = "~";
//# sourceMappingURL=appinfo.js.map