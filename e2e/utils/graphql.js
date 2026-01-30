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
import fetch from "cross-fetch";
import { ApolloClient, InMemoryCache, createHttpLink, gql, ApolloLink, } from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";
import { ContactsDocument, IntraLedgerPaymentSendDocument, LnInvoicePaymentSendDocument, LnNoAmountInvoiceCreateDocument, LnNoAmountInvoicePaymentSendDocument, LnNoAmountUsdInvoicePaymentSendDocument, UserUpdateLanguageDocument, WalletCurrency, WalletsDocument, AccountUpdateDisplayCurrencyDocument, UserEmailDeleteDocument, } from "../../app/graphql/generated";
var config = {
    network: "signet",
    graphqlUrl: "https://api.staging.blink.sv/graphql",
};
var createGaloyServerClient = function (config) { return function (authToken) {
    var httpLink = createHttpLink({
        uri: config.graphqlUrl,
        headers: {
            authorization: authToken ? "Bearer ".concat(authToken) : "",
        },
        fetch: fetch,
    });
    var retryLink = new RetryLink();
    var link = ApolloLink.from([retryLink, httpLink]);
    return new ApolloClient({
        ssrMode: true,
        link: link,
        cache: new InMemoryCache(),
    });
}; };
var getRandomPhoneNumber = function () {
    var randomDigits = Math.floor(Math.random() * 40 + 60) // Generates a number between 60 and 99
        .toString();
    return "+503650555".concat(randomDigits);
};
export var phoneNumber = getRandomPhoneNumber();
export var otp = process.env.GALOY_STAGING_GLOBAL_OTP;
if (otp === undefined) {
    console.error("--------------------------------");
    console.error("GALOY_STAGING_GLOBAL_OTP not set");
    console.error("--------------------------------");
    process.exit(1);
}
var TokenStore = {
    token: "",
};
export var setUserToken = function (token) {
    TokenStore.token = token;
};
export var userToken = function () {
    return TokenStore.token;
};
var receiverToken = process.env.GALOY_TOKEN_2 || "";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query wallets {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          walletCurrency\n          id\n        }\n      }\n    }\n  }\n"], ["\n  query wallets {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          walletCurrency\n          id\n        }\n      }\n    }\n  }\n"])));
export var checkContact = function (username) { return __awaiter(void 0, void 0, void 0, function () {
    var client, contactResult, contactList, isContactAvailable;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                client = createGaloyServerClient(config)(userToken());
                return [4 /*yield*/, client.query({
                        query: ContactsDocument,
                        fetchPolicy: "no-cache",
                    })];
            case 1:
                contactResult = _c.sent();
                contactList = (_a = contactResult.data.me) === null || _a === void 0 ? void 0 : _a.contacts;
                isContactAvailable = (_b = contactResult.data.me) === null || _b === void 0 ? void 0 : _b.contacts.some(function (contact) { return contact.username.toLocaleLowerCase() === (username === null || username === void 0 ? void 0 : username.toLocaleLowerCase()); });
                return [2 /*return*/, { isContactAvailable: isContactAvailable, contactList: contactList }];
        }
    });
}); };
var getWalletId = function (client, walletCurrency) { return __awaiter(void 0, void 0, void 0, function () {
    var accountResult, walletId;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.query({
                    query: WalletsDocument,
                    fetchPolicy: "no-cache",
                })];
            case 1:
                accountResult = _b.sent();
                walletId = (_a = accountResult.data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.wallets.filter(function (w) { return w.walletCurrency === walletCurrency; })[0].id;
                return [2 /*return*/, walletId];
        }
    });
}); };
export var getInvoice = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client, walletId, result, invoice;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                client = createGaloyServerClient(config)(receiverToken);
                return [4 /*yield*/, getWalletId(client, "BTC")];
            case 1:
                walletId = _a.sent();
                return [4 /*yield*/, client.mutate({
                        variables: { input: { walletId: walletId } }, // (lookup wallet 2 id from graphql) i.e "8914b38f-b0ea-4639-9f01-99c03125eea5"
                        mutation: LnNoAmountInvoiceCreateDocument,
                        fetchPolicy: "no-cache",
                    })];
            case 2:
                result = _a.sent();
                invoice = result.data.lnNoAmountInvoiceCreate.invoice.paymentRequest;
                return [2 /*return*/, invoice];
        }
    });
}); };
export var payAmountInvoice = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var client, walletId, result, paymentStatus;
    var _c;
    var invoice = _b.invoice, memo = _b.memo;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                client = createGaloyServerClient(config)(receiverToken);
                return [4 /*yield*/, getWalletId(client, "BTC")];
            case 1:
                walletId = _d.sent();
                return [4 /*yield*/, client.mutate({
                        variables: {
                            input: {
                                memo: memo,
                                walletId: walletId,
                                paymentRequest: invoice,
                            },
                        },
                        mutation: LnInvoicePaymentSendDocument,
                        fetchPolicy: "no-cache",
                    })];
            case 2:
                result = _d.sent();
                paymentStatus = (_c = result.data) === null || _c === void 0 ? void 0 : _c.lnInvoicePaymentSend.status;
                return [2 /*return*/, { paymentStatus: paymentStatus, result: result }];
        }
    });
}); };
export var payNoAmountInvoice = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var client, walletId, mutation, amount, result, paymentStatus;
    var _c, _d;
    var invoice = _b.invoice, walletCurrency = _b.walletCurrency;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                client = createGaloyServerClient(config)(receiverToken);
                return [4 /*yield*/, getWalletId(client, walletCurrency)];
            case 1:
                walletId = _e.sent();
                mutation = walletCurrency === WalletCurrency.Btc
                    ? LnNoAmountInvoicePaymentSendDocument
                    : LnNoAmountUsdInvoicePaymentSendDocument;
                amount = walletCurrency === WalletCurrency.Btc ? 150 : 2;
                return [4 /*yield*/, client.mutate({
                        variables: {
                            input: {
                                walletId: walletId,
                                paymentRequest: invoice,
                                amount: amount,
                            },
                        },
                        mutation: mutation,
                        fetchPolicy: "no-cache",
                    })];
            case 2:
                result = _e.sent();
                if (result.data) {
                    if ("lnNoAmountInvoicePaymentSend" in result.data) {
                        paymentStatus = (_c = result.data) === null || _c === void 0 ? void 0 : _c.lnNoAmountInvoicePaymentSend.status;
                    }
                    else if ("lnNoAmountUsdInvoicePaymentSend" in result.data) {
                        paymentStatus = (_d = result.data) === null || _d === void 0 ? void 0 : _d.lnNoAmountUsdInvoicePaymentSend.status;
                    }
                }
                return [2 /*return*/, { paymentStatus: paymentStatus, result: result }];
        }
    });
}); };
export var resetLanguage = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client;
    return __generator(this, function (_a) {
        client = createGaloyServerClient(config)(userToken());
        return [2 /*return*/, client.mutate({
                variables: {
                    input: {
                        language: "DEFAULT",
                    },
                },
                mutation: UserUpdateLanguageDocument,
                fetchPolicy: "no-cache",
            })];
    });
}); };
export var resetEmail = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client;
    return __generator(this, function (_a) {
        client = createGaloyServerClient(config)(userToken());
        return [2 /*return*/, client.mutate({
                variables: {
                    input: {
                        language: "",
                    },
                },
                mutation: UserEmailDeleteDocument,
                fetchPolicy: "no-cache",
            })];
    });
}); };
export var payTestUsername = function () { return __awaiter(void 0, void 0, void 0, function () {
    var userClient, recipientClient, walletId, recipientWalletId, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                userClient = createGaloyServerClient(config)(userToken());
                recipientClient = createGaloyServerClient(config)(receiverToken);
                return [4 /*yield*/, getWalletId(userClient, "BTC")];
            case 1:
                walletId = _a.sent();
                return [4 /*yield*/, getWalletId(recipientClient, "BTC")];
            case 2:
                recipientWalletId = _a.sent();
                return [4 /*yield*/, userClient.mutate({
                        variables: {
                            input: {
                                walletId: walletId,
                                recipientWalletId: recipientWalletId,
                                amount: 100,
                            },
                        },
                        mutation: IntraLedgerPaymentSendDocument,
                        fetchPolicy: "no-cache",
                    })];
            case 3:
                result = _a.sent();
                return [2 /*return*/, result];
        }
    });
}); };
export var resetDisplayCurrency = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                client = createGaloyServerClient(config)(userToken());
                return [4 /*yield*/, client.mutate({
                        variables: {
                            input: {
                                currency: "USD",
                            },
                        },
                        mutation: AccountUpdateDisplayCurrencyDocument,
                        fetchPolicy: "no-cache",
                    })];
            case 1:
                result = _a.sent();
                return [2 /*return*/, result];
        }
    });
}); };
var templateObject_1;
//# sourceMappingURL=graphql.js.map