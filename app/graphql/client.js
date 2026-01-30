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
import { AsyncStorageWrapper, CachePersistor } from "apollo3-cache-persist";
import { createClient } from "graphql-ws";
import jsSha256 from "js-sha256";
import React, { useCallback, useEffect, useRef, useState } from "react";
import DeviceInfo from "react-native-device-info";
import { ApolloClient, ApolloLink, ApolloProvider, HttpLink, split, } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { RetryLink } from "@apollo/client/link/retry";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { SCHEMA_VERSION_KEY } from "@app/config";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { getAppCheckToken } from "@app/screens/get-started-screen/use-device-token";
import { getLanguageFromString, getLocaleFromLanguage } from "@app/utils/locale-detector";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isIos } from "../utils/helper";
import { loadString, saveString } from "../utils/storage";
import { AnalyticsContainer } from "./analytics";
import { createCache } from "./cache";
import { useLanguageQuery, useRealtimePriceQuery } from "./generated";
import { HideAmountContainer } from "./hide-amount-component";
import { IsAuthedContextProvider, useIsAuthed } from "./is-authed-context";
import { LevelContainer } from "./level-component";
import { MessagingContainer } from "./messaging";
import { NetworkErrorContextProvider } from "./network-error-context";
var noRetryOperations = [
    "intraLedgerPaymentSend",
    "intraLedgerUsdPaymentSend",
    "lnInvoiceFeeProbe",
    "lnInvoicePaymentSend",
    "lnNoAmountInvoiceFeeProbe",
    "lnNoAmountInvoicePaymentSend",
    "lnNoAmountUsdInvoiceFeeProbe",
    "lnUsdInvoiceFeeProbe",
    "lnNoAmountUsdInvoicePaymentSend",
    "onChainPaymentSend",
    "onChainUsdPaymentSend",
    "onChainUsdPaymentSendAsBtcDenominated",
    "onChainTxFee",
    "onChainUsdTxFee",
    "onChainUsdTxFeeAsBtcDenominated",
    // no need to retry to upload the token
    // specially as it's running on app start
    // and can create some unwanted loop when token is not valid
    "deviceNotificationTokenCreate",
];
var getAuthorizationHeader = function (token) {
    return "Bearer ".concat(token);
};
var GaloyClient = function (_a) {
    var children = _a.children;
    var appConfig = useAppConfig().appConfig;
    var _b = useState(undefined), networkError = _b[0], setNetworkError = _b[1];
    var hasNetworkErrorRef = useRef(false);
    var clearNetworkError = useCallback(function () {
        setNetworkError(undefined);
        hasNetworkErrorRef.current = false;
    }, []);
    var _c = useState(), apolloClient = _c[0], setApolloClient = _c[1];
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var token, appCheckLink, wsLinkConnectionParams, wsLink, errorLink, retryLink, retry401ErrorLink, authLink, sha256, persistedQueryLink, httpLink, link, cache, persistor, readableVersion, client, SCHEMA_VERSION, currentVersion;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        token = appConfig.token;
                        console.log("creating new apollo client, token: ".concat(Boolean(token), ", uri: ").concat(appConfig.galoyInstance.graphqlUri));
                        appCheckLink = setContext(function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
                            var appCheckToken;
                            var headers = _b.headers;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, getAppCheckToken()];
                                    case 1:
                                        appCheckToken = _c.sent();
                                        return [2 /*return*/, appCheckToken
                                                ? {
                                                    headers: __assign(__assign({}, headers), { Appcheck: appCheckToken }),
                                                }
                                                : {
                                                    headers: headers,
                                                }];
                                }
                            });
                        }); });
                        wsLinkConnectionParams = function () { return __awaiter(void 0, void 0, void 0, function () {
                            var authHeaders, appCheckToken, appCheckHeaders;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        authHeaders = token ? { Authorization: getAuthorizationHeader(token) } : {};
                                        return [4 /*yield*/, getAppCheckToken()];
                                    case 1:
                                        appCheckToken = _a.sent();
                                        appCheckHeaders = appCheckToken ? { Appcheck: appCheckToken } : {};
                                        return [2 /*return*/, __assign(__assign({}, authHeaders), appCheckHeaders)];
                                }
                            });
                        }); };
                        wsLink = new GraphQLWsLink(createClient({
                            url: appConfig.galoyInstance.graphqlWsUri,
                            retryAttempts: 12,
                            connectionParams: wsLinkConnectionParams,
                            shouldRetry: function (errOrCloseEvent) {
                                console.warn({ errOrCloseEvent: errOrCloseEvent }, "entering shouldRetry function for websocket");
                                // TODO: understand how the backend is closing the connection
                                // for instance during a new version rollout or k8s upgrade
                                //
                                // in the meantime:
                                // returning true instead of the default 'Any non-`CloseEvent`'
                                // to force createClient to attempt a reconnection
                                return true;
                            },
                            // Voluntary not using: webSocketImpl: WebSocket
                            // seems react native already have an implement of the websocket?
                            //
                            // TODO: implement keepAlive and reconnection?
                            // https://github.com/enisdenjo/graphql-ws/blob/master/docs/interfaces/client.ClientOptions.md#keepalive
                        }));
                        errorLink = onError(function (_a) {
                            var graphQLErrors = _a.graphQLErrors, networkError = _a.networkError;
                            // graphqlErrors should be managed locally
                            if (graphQLErrors)
                                graphQLErrors.forEach(function (_a) {
                                    var message = _a.message, locations = _a.locations, path = _a.path;
                                    if (message === "PersistedQueryNotFound") {
                                        console.log("[GraphQL info]: Message: ".concat(message, ", Path: ").concat(path, "}"), {
                                            locations: locations,
                                        });
                                    }
                                    else {
                                        console.warn("[GraphQL error]: Message: ".concat(message, ", Path: ").concat(path, "}"), {
                                            locations: locations,
                                        });
                                    }
                                });
                            // only network error are managed globally
                            if (networkError) {
                                console.log("[Network error]: ".concat(networkError));
                                if (!hasNetworkErrorRef.current) {
                                    setNetworkError(networkError);
                                    hasNetworkErrorRef.current = true;
                                }
                            }
                        });
                        retryLink = new RetryLink({
                            attempts: {
                                max: 5,
                                retryIf: function (error, operation) {
                                    console.debug(JSON.stringify(error), "retry on error");
                                    return (Boolean(error) &&
                                        !noRetryOperations.includes(operation.operationName) &&
                                        error.statusCode !== 401);
                                },
                            },
                        });
                        retry401ErrorLink = new RetryLink({
                            attempts: {
                                max: 2,
                                retryIf: function (error) {
                                    return error && error.statusCode === 401;
                                },
                            },
                            delay: {
                                initial: 5000, // Initial delay in milliseconds (20 seconds)
                                max: Infinity,
                                jitter: false,
                            },
                        });
                        if (token) {
                            authLink = setContext(function (request, _a) {
                                var headers = _a.headers;
                                return ({
                                    headers: __assign({ authorization: getAuthorizationHeader(token) }, headers),
                                });
                            });
                        }
                        else {
                            authLink = setContext(function (request, _a) {
                                var headers = _a.headers;
                                return ({
                                    headers: __assign({ authorization: "" }, headers),
                                });
                            });
                        }
                        sha256 = jsSha256;
                        persistedQueryLink = createPersistedQueryLink({ sha256: sha256 });
                        httpLink = new HttpLink({
                            uri: appConfig.galoyInstance.graphqlUri,
                        });
                        link = split(function (_a) {
                            var query = _a.query;
                            var definition = getMainDefinition(query);
                            return (definition.kind === "OperationDefinition" &&
                                definition.operation === "subscription");
                        }, wsLink, ApolloLink.from([
                            errorLink,
                            retryLink,
                            appCheckLink,
                            authLink,
                            retry401ErrorLink,
                            persistedQueryLink,
                            httpLink,
                        ]));
                        cache = createCache();
                        persistor = new CachePersistor({
                            cache: cache,
                            storage: new AsyncStorageWrapper(AsyncStorage),
                            debug: __DEV__,
                            persistenceMapper: function (_data) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    // TODO:
                                    // we should only store the last 20 transactions to keep the cache small
                                    // there could be other data to filter as well
                                    // filter your cached data and queries
                                    // return filteredData
                                    return [2 /*return*/, _data];
                                });
                            }); },
                        });
                        readableVersion = DeviceInfo.getReadableVersion();
                        client = new ApolloClient({
                            cache: cache,
                            link: link,
                            name: isIos ? "iOS" : "Android",
                            version: readableVersion,
                            connectToDevTools: true,
                        });
                        SCHEMA_VERSION = "1";
                        return [4 /*yield*/, loadString(SCHEMA_VERSION_KEY)];
                    case 1:
                        currentVersion = _a.sent();
                        if (!(currentVersion === SCHEMA_VERSION)) return [3 /*break*/, 3];
                        // If the current version matches the latest version,
                        // we're good to go and can restore the cache.
                        return [4 /*yield*/, persistor.restore()];
                    case 2:
                        // If the current version matches the latest version,
                        // we're good to go and can restore the cache.
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 3: 
                    // Otherwise, we'll want to purge the outdated persisted cache
                    // and mark ourselves as having updated to the latest version.
                    // init the DB. will be override if a cache exists
                    return [4 /*yield*/, persistor.purge()];
                    case 4:
                        // Otherwise, we'll want to purge the outdated persisted cache
                        // and mark ourselves as having updated to the latest version.
                        // init the DB. will be override if a cache exists
                        _a.sent();
                        return [4 /*yield*/, saveString(SCHEMA_VERSION_KEY, SCHEMA_VERSION)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        client.onClearStore(persistor.purge);
                        setApolloClient({
                            client: client,
                            isAuthed: Boolean(token),
                        });
                        clearNetworkError();
                        return [2 /*return*/, function () { return client.cache.reset(); }];
                }
            });
        }); })();
    }, [appConfig.token, appConfig.galoyInstance, clearNetworkError]);
    // Before we show the app, we have to wait for our state to be ready.
    // In the meantime, don't render anything. This will be the background
    // color set in native by rootView's background color.
    //
    // This step should be completely covered over by the splash screen though.
    //
    // You're welcome to swap in your own component to render if your boot up
    // sequence is too slow though.
    if (!apolloClient) {
        return <></>;
    }
    return (<ApolloProvider client={apolloClient.client}>
      <IsAuthedContextProvider value={apolloClient.isAuthed}>
        <LevelContainer>
          <HideAmountContainer>
            <NetworkErrorContextProvider value={{
            networkError: networkError,
            clearNetworkError: clearNetworkError,
            token: appConfig.token,
        }}>
              <MessagingContainer />
              <LanguageSync />
              <AnalyticsContainer />
              <MyPriceUpdates />
              {children}
            </NetworkErrorContextProvider>
          </HideAmountContainer>
        </LevelContainer>
      </IsAuthedContextProvider>
    </ApolloProvider>);
};
var MyPriceUpdates = function () {
    var isAuthed = useIsAuthed();
    var pollInterval = 5 * 60 * 1000; // 5 min
    useRealtimePriceQuery({
        // only fetch after pollInterval
        // the first query is done by the home page automatically
        fetchPolicy: "cache-only",
        nextFetchPolicy: "network-only",
        pollInterval: pollInterval,
        skip: !isAuthed,
    });
    return null;
};
var LanguageSync = function () {
    var _a;
    var isAuthed = useIsAuthed();
    var data = useLanguageQuery({ fetchPolicy: "cache-first", skip: !isAuthed }).data;
    var userPreferredLocale = getLocaleFromLanguage(getLanguageFromString((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.language));
    var _b = useI18nContext(), locale = _b.locale, setLocale = _b.setLocale;
    useEffect(function () {
        if (userPreferredLocale !== locale) {
            setLocale(userPreferredLocale);
        }
        // setLocale is not set as a dependency because it changes every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userPreferredLocale, locale]);
    return <></>;
};
export { GaloyClient };
//# sourceMappingURL=client.js.map