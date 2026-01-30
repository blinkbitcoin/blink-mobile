var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { exec } from "child_process";
import path from "path";
var REPO_ROOT = path.join(__dirname, "../../..");
export var getKratosCode = function (email) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) {
                exec("source \"".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\" && \n      kratos_pg -c \"SELECT body FROM courier_messages WHERE recipient='").concat(email, "' ORDER BY created_at DESC LIMIT 1;\""), { encoding: "utf-8" }, function (_, emailBody, __) {
                    var _a;
                    var code = (_a = emailBody.match(/\b\d{6}\b/)) === null || _a === void 0 ? void 0 : _a[0];
                    resolve(code || "");
                });
            })];
    });
}); };
export var getExternalLNNoAmountInvoice = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) {
                exec("source \"".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\" && \n      lnd_outside_cli addinvoice"), { encoding: "utf-8" }, function (_, invoiceResponse, __) {
                    resolve(JSON.parse(invoiceResponse).payment_request);
                });
            })];
    });
}); };
export var getOnchainAddress = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) {
                exec("source \"".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\" && \n      bitcoin_cli getnewaddress"), { encoding: "utf-8" }, function (_, address, __) {
                    resolve(address);
                });
            })];
    });
}); };
export var getLnInvoiceForBob = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) {
                exec("source ".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/bin/helpers.sh\n      source ").concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\n\n      cd ").concat(REPO_ROOT, "/dev\n\n      variables=$(\n        jq -n         --arg wallet_id \"$(read_value 'bob.btc_wallet_id')\"         '{input: {walletId: $wallet_id}}'\n      )\n      exec_graphql \"bob\" 'ln-no-amount-invoice-create' \"$variables\"\n      invoice=\"$(graphql_output '.data.lnNoAmountInvoiceCreate.invoice')\"\n      payment_request=\"$(echo $invoice | jq -r '.paymentRequest')\"\n\n      echo $payment_request\n    "), { encoding: "utf-8" }, function (_, output, __) {
                    resolve(output);
                });
            })];
    });
}); };
export var sendLnPaymentFromBob = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var paymentRequest = _b.paymentRequest, amount = _b.amount;
    return __generator(this, function (_c) {
        return [2 /*return*/, new Promise(function (resolve, reject) {
                if (amount) {
                    exec("source ".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/bin/helpers.sh\n      source ").concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\n\n      cd ").concat(REPO_ROOT, "/dev\n\n      variables=$(\n        jq -n         --arg wallet_id \"$(read_value 'bob.usd_wallet_id')\"         --arg payment_request \"").concat(paymentRequest, "\"         --arg amount \"").concat(amount, "\"         '{input: {walletId: $wallet_id, paymentRequest: $payment_request, amount: $amount}}'\n      )\n      exec_graphql \"bob\" 'ln-no-amount-usd-invoice-payment-send' \"$variables\"\n      graphql_output\n    "), { encoding: "utf-8" }, function (_, output, __) {
                        var jsonOutput = JSON.parse(output);
                        if (jsonOutput.data.lnNoAmountUsdInvoicePaymentSend.status === "SUCCESS")
                            return resolve(jsonOutput);
                        reject(new Error("LN Payment from Bob was not successful"));
                    });
                }
                else {
                    exec("source ".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/bin/helpers.sh\n        source ").concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\n\n        cd ").concat(REPO_ROOT, "/dev\n\n        variables=$(\n          jq -n           --arg wallet_id \"$(read_value 'bob.btc_wallet_id')\"           --arg payment_request \"").concat(paymentRequest, "\"           '{input: {walletId: $wallet_id, paymentRequest: $payment_request}}'\n        )\n        exec_graphql \"bob\" 'ln-invoice-payment-send' \"$variables\"\n        graphql_output\n      "), { encoding: "utf-8" }, function (_, output, __) {
                        var jsonOutput = JSON.parse(output);
                        if (jsonOutput.data.lnInvoicePaymentSend.status === "SUCCESS")
                            return resolve(jsonOutput);
                        reject(new Error("LN Payment from Bob was not successful"));
                    });
                }
            })];
    });
}); };
export var sendBtcTo = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var address = _b.address;
    return __generator(this, function (_c) {
        return [2 /*return*/, new Promise(function (resolve) {
                exec("source \"".concat(REPO_ROOT, "/dev/vendor/galoy-quickstart/dev/helpers/cli.sh\" && \n      bitcoin_cli sendtoaddress \"").concat(address, "\" 0.01 &&\n      bitcoin_cli -generate 2"), { encoding: "utf-8" }, function (_, output, __) {
                    resolve(output);
                });
            })];
    });
}); };
//# sourceMappingURL=commandline.js.map