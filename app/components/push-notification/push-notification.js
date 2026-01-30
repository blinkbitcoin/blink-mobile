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
import React, { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { addDeviceToken, hasNotificationPermission } from "@app/utils/notifications";
import messaging from "@react-native-firebase/messaging";
import { Linking } from "react-native";
export var PushNotificationComponent = function () {
    var client = useApolloClient();
    var isAuthed = useIsAuthed();
    useEffect(function () {
        var followNotificationLink = function (remoteMessage) {
            var _a, _b;
            try {
                var linkToScreen = (_b = (_a = remoteMessage.data) === null || _a === void 0 ? void 0 : _a.linkTo) !== null && _b !== void 0 ? _b : "";
                if (typeof linkToScreen === "string" &&
                    linkToScreen &&
                    linkToScreen.startsWith("/")) {
                    Linking.openURL("blink:" + linkToScreen);
                }
                // linkTo throws an error if the link is invalid
            }
            catch (error) {
                console.error("Error in showNotification", error);
            }
        };
        // When the application is running, but in the background.
        var unsubscribeBackground = messaging().onNotificationOpenedApp(function (remoteMessage) {
            followNotificationLink(remoteMessage);
        });
        var unsubscribeInApp = messaging().onMessage(function (remoteMessage) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("A new FCM message arrived!", remoteMessage);
                return [2 /*return*/];
            });
        }); });
        // When the application is opened from a quit state.
        messaging()
            .getInitialNotification()
            .then(function (remoteMessage) {
            if (remoteMessage) {
                followNotificationLink(remoteMessage);
            }
        });
        return function () {
            unsubscribeInApp();
            unsubscribeBackground();
        };
    }, []);
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var hasPermission, unsubscribeFromRefresh;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(isAuthed && client)) return [3 /*break*/, 2];
                        return [4 /*yield*/, hasNotificationPermission()];
                    case 1:
                        hasPermission = _a.sent();
                        if (hasPermission) {
                            addDeviceToken(client);
                            unsubscribeFromRefresh = messaging().onTokenRefresh(function () {
                                return addDeviceToken(client);
                            });
                            return [2 /*return*/, unsubscribeFromRefresh];
                        }
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); })();
    }, [client, isAuthed]);
    return <></>;
};
//# sourceMappingURL=push-notification.js.map