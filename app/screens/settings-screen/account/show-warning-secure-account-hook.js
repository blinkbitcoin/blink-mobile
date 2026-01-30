var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { gql } from "@apollo/client";
import { useWarningSecureAccountQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { usePriceConversion } from "@app/hooks";
import { ZeroUsdMoneyAmount, addMoneyAmounts, greaterThanOrEqualTo, toBtcMoneyAmount, toUsdMoneyAmount, } from "@app/types/amounts";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query warningSecureAccount {\n    me {\n      id\n      defaultAccount {\n        level\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  query warningSecureAccount {\n    me {\n      id\n      defaultAccount {\n        level\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
var minimumBalance = 500; // $5
export var useShowWarningSecureAccount = function () {
    var _a, _b, _c, _d, _e, _f;
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    var isAuthed = useIsAuthed();
    var data = useWarningSecureAccountQuery({
        fetchPolicy: "cache-and-network",
        skip: !isAuthed,
    }).data;
    if (((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.level) !== "ZERO")
        return false;
    var btcWallet = getBtcWallet((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.wallets);
    var usdWallet = getUsdWallet((_f = (_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.defaultAccount) === null || _f === void 0 ? void 0 : _f.wallets);
    var usdMoneyAmount = toUsdMoneyAmount(usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance);
    var btcMoneyAmount = toBtcMoneyAmount(btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance);
    var btcBalanceInUsd = (convertMoneyAmount && convertMoneyAmount(btcMoneyAmount, "USD")) ||
        ZeroUsdMoneyAmount;
    var totalBalanceUsd = addMoneyAmounts({
        a: btcBalanceInUsd,
        b: usdMoneyAmount,
    });
    return greaterThanOrEqualTo({
        value: totalBalanceUsd,
        greaterThanOrEqualTo: toUsdMoneyAmount(minimumBalance),
    });
};
var templateObject_1;
//# sourceMappingURL=show-warning-secure-account-hook.js.map