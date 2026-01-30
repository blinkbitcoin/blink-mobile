var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
import React from "react";
import Share from "react-native-share";
import { gql } from "@apollo/client";
import { useExportCsvSettingLazyQuery, useSettingsScreenQuery, } from "@app/graphql/generated";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import crashlytics from "@react-native-firebase/crashlytics";
import { SettingsRow } from "../row";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query ExportCsvSetting($walletIds: [WalletId!]!) {\n    me {\n      id\n      defaultAccount {\n        id\n        csvTransactions(walletIds: $walletIds)\n      }\n    }\n  }\n"], ["\n  query ExportCsvSetting($walletIds: [WalletId!]!) {\n    me {\n      id\n      defaultAccount {\n        id\n        csvTransactions(walletIds: $walletIds)\n      }\n    }\n  }\n"])));
export var ExportCsvSetting = function () {
    var _a, _b, _c, _d;
    var LL = useI18nContext().LL;
    var _e = useSettingsScreenQuery(), data = _e.data, loading = _e.loading;
    var btcWallet = getBtcWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets);
    var usdWallet = getUsdWallet((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.wallets);
    var btcWalletId = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.id;
    var usdWalletId = usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.id;
    var _f = useExportCsvSettingLazyQuery({
        fetchPolicy: "network-only",
    }), fetchCsvTransactionsQuery = _f[0], spinner = _f[1].loading;
    var fetchCsvTransactions = function () { return __awaiter(void 0, void 0, void 0, function () {
        var walletIds, data, csvEncoded, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    walletIds = [];
                    if (btcWalletId)
                        walletIds.push(btcWalletId);
                    if (usdWalletId)
                        walletIds.push(usdWalletId);
                    return [4 /*yield*/, fetchCsvTransactionsQuery({
                            variables: { walletIds: walletIds },
                        })];
                case 1:
                    data = (_c.sent()).data;
                    csvEncoded = (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.csvTransactions;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, Share.open({
                            title: "blink-transactions",
                            filename: "blink-transactions.csv",
                            url: "data:text/comma-separated-values;base64,".concat(csvEncoded),
                            type: "text/comma-separated-values",
                        })];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _c.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                    }
                    console.error(err_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<SettingsRow loading={loading} spinner={spinner} title={LL.common.csvExport()} leftIcon="list-outline" rightIcon={"download-outline"} action={fetchCsvTransactions}/>);
};
var templateObject_1;
//# sourceMappingURL=advanced-export-csv.js.map