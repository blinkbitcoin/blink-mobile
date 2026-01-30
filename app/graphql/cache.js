var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { InMemoryCache, gql } from "@apollo/client";
import { relayStylePagination } from "@apollo/client/utilities";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query realtimePrice {\n    me {\n      id\n      defaultAccount {\n        id\n        realtimePrice {\n          btcSatPrice {\n            base\n            offset\n          }\n          denominatorCurrency\n          id\n          timestamp\n          usdCentPrice {\n            base\n            offset\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query realtimePrice {\n    me {\n      id\n      defaultAccount {\n        id\n        realtimePrice {\n          btcSatPrice {\n            base\n            offset\n          }\n          denominatorCurrency\n          id\n          timestamp\n          usdCentPrice {\n            base\n            offset\n          }\n        }\n      }\n    }\n  }\n"])));
export var createCache = function () {
    return new InMemoryCache({
        possibleTypes: {
            // TODO: add other possible types
            Account: ["ConsumerAccount"],
        },
        typePolicies: {
            Globals: {
                // singleton: only cache latest version:
                // https://www.apollographql.com/docs/react/caching/cache-configuration/#customizing-cache-ids
                keyFields: [],
            },
            RealtimePrice: {
                keyFields: [],
            },
            MapMarker: {
                keyFields: ["mapInfo", ["title", "coordinates"]],
            },
            Contact: {
                fields: {
                    prettyName: {
                        read: function (_, _a) {
                            var readField = _a.readField;
                            return readField("id") || readField("name");
                        },
                    },
                },
            },
            UserContact: {
                fields: {
                    transactions: relayStylePagination(),
                },
            },
            Earn: {
                fields: {
                    completed: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                },
            },
            TxLastSeen: {
                keyFields: ["accountId"],
            },
            Query: {
                fields: {
                    // local only fields
                    hideBalance: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    hiddenBalanceToolTip: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    beta: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    colorScheme: {
                        read: function (value) { return value !== null && value !== void 0 ? value : "system"; },
                    },
                    countryCode: {
                        read: function (value) { return value !== null && value !== void 0 ? value : "SV"; },
                    },
                    region: {
                        read: function (value) { return value !== null && value !== void 0 ? value : null; },
                    },
                    feedbackModalShown: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    hasPromptedSetDefaultAccount: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    introducingCirclesModalShown: {
                        read: function (value) { return value !== null && value !== void 0 ? value : false; },
                    },
                    innerCircleValue: {
                        read: function (value) { return value !== null && value !== void 0 ? value : -1; },
                    },
                    upgradeModalLastShownAt: {
                        read: function (value) { return value !== null && value !== void 0 ? value : null; },
                    },
                    deviceSessionCount: {
                        read: function (value) { return value !== null && value !== void 0 ? value : 0; },
                    },
                    txLastSeen: {
                        keyArgs: ["accountId"],
                        read: function (value, _a) {
                            var args = _a.args;
                            if (value)
                                return value;
                            return {
                                __typename: "TxLastSeen",
                                accountId: (args === null || args === void 0 ? void 0 : args.accountId) || "",
                                btcId: "",
                                usdId: "",
                            };
                        },
                    },
                },
            },
            Wallet: {
                fields: {
                    transactions: relayStylePagination(),
                },
            },
            Account: {
                fields: {
                    transactions: relayStylePagination(["walletIds"]),
                },
            },
        },
    });
};
var templateObject_1;
//# sourceMappingURL=cache.js.map