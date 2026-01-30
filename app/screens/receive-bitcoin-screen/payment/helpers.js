var _a;
import { decodeInvoiceString, } from "@blinkbitcoin/blink-client";
import { Invoice } from "./index.types";
var prefixByType = (_a = {},
    _a[Invoice.OnChain] = "bitcoin:",
    _a[Invoice.Lightning] = "lightning:",
    _a[Invoice.PayCode] = "",
    _a);
export var getPaymentRequestFullUri = function (_a) {
    var input = _a.input, amount = _a.amount, memo = _a.memo, _b = _a.uppercase, uppercase = _b === void 0 ? false : _b, _c = _a.prefix, prefix = _c === void 0 ? true : _c, _d = _a.type, type = _d === void 0 ? Invoice.OnChain : _d;
    if (type === Invoice.Lightning) {
        return uppercase ? input.toUpperCase() : input;
    }
    var uriPrefix = prefix ? prefixByType[type] : "";
    var uri = "".concat(uriPrefix).concat(input);
    var params = new URLSearchParams();
    if (amount)
        params.append("amount", "".concat(satsToBTC(amount)));
    if (memo) {
        params.append("message", encodeURI(memo));
        return "".concat(uri, "?").concat(params.toString());
    }
    return uri + (params.toString() ? "?" + params.toString() : "");
};
export var satsToBTC = function (satsAmount) { return satsAmount / Math.pow(10, 8); };
export var getDefaultMemo = function (bankName) {
    return "Pay to ".concat(bankName, " Wallet user");
};
export var secondsToH = function (seconds) {
    var h = Math.floor(seconds / 3600);
    var hDisplay = h > 0 ? h + "h" : "";
    return hDisplay;
};
export var secondsToHMS = function (seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var hDisplay = h > 0 ? h + "h" : "";
    var mDisplay = m > 0 ? m + "m" : "";
    var sDisplay = s > 0 ? s + "s" : "";
    return hDisplay + mDisplay + sDisplay;
};
export var generateFutureLocalTime = function (secondsToAdd) {
    var date = new Date(); // Get current date
    date.setSeconds(date.getSeconds() + secondsToAdd); // Add seconds to the current date
    // Format to local time string
    var hours = date.getHours() % 12 || 12; // Get hours (12 hour format), replace 0 with 12
    var minutes = String(date.getMinutes()).padStart(2, "0"); // Get minutes
    var period = date.getHours() >= 12 ? "PM" : "AM"; // Get AM/PM
    return "".concat(hours, ":").concat(minutes).concat(period);
};
export var prToDateString = function (paymentRequest, network) {
    var dateString;
    try {
        dateString = decodeInvoiceString(paymentRequest, network).timeExpireDateString;
    }
    catch (e) {
        console.error(e);
    }
    return dateString;
};
//# sourceMappingURL=helpers.js.map