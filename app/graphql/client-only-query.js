var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { gql } from "@apollo/client";
import { BetaDocument, ColorSchemeDocument, CountryCodeDocument, FeedbackModalShownDocument, HasPromptedSetDefaultAccountDocument, HiddenBalanceToolTipDocument, HideBalanceDocument, InnerCircleValueDocument, IntroducingCirclesModalShownDocument, RegionDocument, UpgradeModalLastShownAtDocument, DeviceSessionCountDocument, TxLastSeenDocument, WalletCurrency, } from "./generated";
export default gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query hideBalance {\n    hideBalance @client\n  }\n\n  query hiddenBalanceToolTip {\n    hiddenBalanceToolTip @client\n  }\n\n  query beta {\n    beta @client\n  }\n\n  query colorScheme {\n    colorScheme @client # \"system\" | \"light\" | \"dark\"\n  }\n\n  query countryCode {\n    countryCode @client\n  }\n\n  query region {\n    region @client {\n      latitude\n      longitude\n      latitudeDelta\n      longitudeDelta\n    }\n  }\n\n  query feedbackModalShown {\n    feedbackModalShown @client\n  }\n\n  query hasPromptedSetDefaultAccount {\n    hasPromptedSetDefaultAccount @client\n  }\n\n  query introducingCirclesModalShown {\n    introducingCirclesModalShown @client\n  }\n\n  query innerCircleValue {\n    innerCircleValue @client\n  }\n\n  query upgradeModalLastShownAt {\n    upgradeModalLastShownAt @client\n  }\n\n  query deviceSessionCount {\n    deviceSessionCount @client\n  }\n\n  query txLastSeen($accountId: ID!) {\n    txLastSeen(accountId: $accountId) @client {\n      accountId\n      btcId\n      usdId\n    }\n  }\n"], ["\n  query hideBalance {\n    hideBalance @client\n  }\n\n  query hiddenBalanceToolTip {\n    hiddenBalanceToolTip @client\n  }\n\n  query beta {\n    beta @client\n  }\n\n  query colorScheme {\n    colorScheme @client # \"system\" | \"light\" | \"dark\"\n  }\n\n  query countryCode {\n    countryCode @client\n  }\n\n  query region {\n    region @client {\n      latitude\n      longitude\n      latitudeDelta\n      longitudeDelta\n    }\n  }\n\n  query feedbackModalShown {\n    feedbackModalShown @client\n  }\n\n  query hasPromptedSetDefaultAccount {\n    hasPromptedSetDefaultAccount @client\n  }\n\n  query introducingCirclesModalShown {\n    introducingCirclesModalShown @client\n  }\n\n  query innerCircleValue {\n    innerCircleValue @client\n  }\n\n  query upgradeModalLastShownAt {\n    upgradeModalLastShownAt @client\n  }\n\n  query deviceSessionCount {\n    deviceSessionCount @client\n  }\n\n  query txLastSeen($accountId: ID!) {\n    txLastSeen(accountId: $accountId) @client {\n      accountId\n      btcId\n      usdId\n    }\n  }\n"])));
export var saveHideBalance = function (client, status) {
    try {
        client.writeQuery({
            query: HideBalanceDocument,
            data: {
                __typename: "Query",
                hideBalance: status,
            },
        });
        return status;
    }
    catch (_a) {
        return false;
    }
};
export var saveHiddenBalanceToolTip = function (client, status) {
    try {
        client.writeQuery({
            query: HiddenBalanceToolTipDocument,
            data: {
                __typename: "Query",
                hiddenBalanceToolTip: status,
            },
        });
        return status;
    }
    catch (_a) {
        return false;
    }
};
export var activateBeta = function (client, status) {
    try {
        client.writeQuery({
            query: BetaDocument,
            data: {
                __typename: "Query",
                beta: status,
            },
        });
    }
    catch (_a) {
        console.warn("impossible to update beta");
    }
};
export var updateColorScheme = function (client, colorScheme) {
    try {
        client.writeQuery({
            query: ColorSchemeDocument,
            data: {
                __typename: "Query",
                colorScheme: colorScheme,
            },
        });
    }
    catch (_a) {
        console.warn("impossible to update color scheme");
    }
};
export var updateCountryCode = function (client, countryCode) {
    try {
        client.writeQuery({
            query: CountryCodeDocument,
            data: {
                __typename: "Query",
                countryCode: countryCode,
            },
        });
    }
    catch (_a) {
        console.warn("impossible to update country code");
    }
};
export var updateMapLastCoords = function (client, region) {
    try {
        client.writeQuery({
            query: RegionDocument,
            data: {
                __typename: "Query",
                region: __assign({ __typename: "Region" }, region),
            },
        });
    }
    catch (_a) {
        console.warn("impossible to update map last coords");
    }
};
export var setFeedbackModalShown = function (client, shown) {
    try {
        client.writeQuery({
            query: FeedbackModalShownDocument,
            data: {
                __typename: "Query",
                feedbackModalShown: shown,
            },
        });
    }
    catch (_a) {
        console.warn("unable to update feedbackModalShown");
    }
};
export var setHasPromptedSetDefaultAccount = function (client) {
    try {
        client.writeQuery({
            query: HasPromptedSetDefaultAccountDocument,
            data: {
                __typename: "Query",
                hasPromptedSetDefaultAccount: true,
            },
        });
    }
    catch (_a) {
        console.warn("impossible to update hasPromptedSetDefaultAccount");
    }
};
export var setIntroducingCirclesModalShown = function (client) {
    try {
        client.writeQuery({
            query: IntroducingCirclesModalShownDocument,
            data: {
                __typename: "Query",
                introducingCirclesModalShown: true,
            },
        });
    }
    catch (_a) {
        console.warn("unable to update introducingCirclesModalShown");
    }
};
export var setInnerCircleCachedValue = function (client, innerCircleValue) {
    try {
        client.writeQuery({
            query: InnerCircleValueDocument,
            data: {
                __typename: "Query",
                innerCircleValue: innerCircleValue,
            },
        });
    }
    catch (_a) {
        console.warn("unable to update InnerCircleValueDocument");
    }
};
export var setUpgradeModalLastShownAt = function (client, isoDatetime) {
    try {
        client.writeQuery({
            query: UpgradeModalLastShownAtDocument,
            data: {
                __typename: "Query",
                upgradeModalLastShownAt: isoDatetime,
            },
        });
        return isoDatetime;
    }
    catch (_a) {
        return null;
    }
};
export var setDeviceSessionCount = function (client, count) {
    try {
        client.writeQuery({
            query: DeviceSessionCountDocument,
            data: { __typename: "Query", deviceSessionCount: count },
        });
        return count;
    }
    catch (_a) {
        return null;
    }
};
export var updateDeviceSessionCount = function (client, _a) {
    var _b, _c;
    var _d = _a === void 0 ? {} : _a, _e = _d.reset, reset = _e === void 0 ? false : _e;
    if (reset)
        return setDeviceSessionCount(client, 0);
    var prev = (_c = (_b = client.readQuery({
        query: DeviceSessionCountDocument,
    })) === null || _b === void 0 ? void 0 : _b.deviceSessionCount) !== null && _c !== void 0 ? _c : 0;
    return setDeviceSessionCount(client, prev + 1);
};
export var markTxLastSeenId = function (_a) {
    var _b, _c, _d, _e;
    var client = _a.client, accountId = _a.accountId, currency = _a.currency, id = _a.id;
    try {
        if (!id)
            return null;
        var prev = client.readQuery({
            query: TxLastSeenDocument,
            variables: { accountId: accountId },
        });
        client.writeQuery({
            query: TxLastSeenDocument,
            variables: { accountId: accountId },
            data: {
                __typename: "Query",
                txLastSeen: {
                    __typename: "TxLastSeen",
                    accountId: accountId,
                    btcId: currency === WalletCurrency.Btc ? id : (_c = (_b = prev === null || prev === void 0 ? void 0 : prev.txLastSeen) === null || _b === void 0 ? void 0 : _b.btcId) !== null && _c !== void 0 ? _c : "",
                    usdId: currency === WalletCurrency.Usd ? id : (_e = (_d = prev === null || prev === void 0 ? void 0 : prev.txLastSeen) === null || _d === void 0 ? void 0 : _d.usdId) !== null && _e !== void 0 ? _e : "",
                },
            },
        });
        return id;
    }
    catch (err) {
        console.error("Failed to mark transaction as seen:", err);
        return null;
    }
};
var templateObject_1;
//# sourceMappingURL=client-only-query.js.map