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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { SettingsScreenDocument } from "@app/graphql/generated";
import { NotificationHistoryScreen } from "@app/screens/notification-history-screen/notification-history-screen";
import { SettingsScreen } from "@app/screens/settings-screen/settings-screen";
import { SettingsRow } from "@app/screens/settings-screen/row";
import { LevelContextProvider, AccountLevel } from "@app/graphql/level-context";
import { LoggedInWithUsername } from "@app/screens/settings-screen/settings-screen.stories";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import mocks from "@app/graphql/mocks";
import { ContextForScreen } from "../helper";
var notificationTitle = "Test notification";
var notificationBody = "Test body";
var notificationCreatedAt = 1720000000;
var baseNotificationNodes = [
    {
        id: "notif-1",
        title: notificationTitle,
        body: notificationBody,
        createdAt: notificationCreatedAt,
        acknowledgedAt: null,
        bulletinEnabled: false,
        icon: null,
        action: null,
        __typename: "StatefulNotification",
    },
    {
        id: "notif-2",
        title: notificationTitle,
        body: notificationBody,
        createdAt: notificationCreatedAt,
        acknowledgedAt: null,
        bulletinEnabled: false,
        icon: null,
        action: null,
        __typename: "StatefulNotification",
    },
    {
        id: "notif-3",
        title: notificationTitle,
        body: notificationBody,
        createdAt: notificationCreatedAt,
        acknowledgedAt: null,
        bulletinEnabled: false,
        icon: null,
        action: null,
        __typename: "StatefulNotification",
    },
];
var buildNotificationNodes = function (unreadCount) {
    return baseNotificationNodes.map(function (notification, index) { return (__assign(__assign({}, notification), { acknowledgedAt: index < unreadCount ? null : 1 })); });
};
var createTestState = function () { return ({
    notificationCount: 3,
    notificationNodes: buildNotificationNodes(3),
    phone: "+50365055539",
    setActiveScreen: null,
    triggerRender: null,
    headerRight: null,
    headerCount: -1,
}); };
var testState = createTestState();
var updateNotificationCount = function (next) {
    testState.notificationCount = next;
    testState.notificationNodes = buildNotificationNodes(next);
    if (testState.triggerRender) {
        testState.triggerRender(function (value) { return value + 1; });
    }
};
var mockNavigate = jest.fn();
jest.mock("@react-navigation/native", function () { return (__assign(__assign({}, jest.requireActual("@react-navigation/native")), { useNavigation: function () { return ({
        navigate: function (screen) {
            mockNavigate(screen);
            if (testState.setActiveScreen) {
                testState.setActiveScreen(screen);
            }
        },
        setOptions: function (options) {
            if (options.headerRight && testState.notificationCount !== testState.headerCount) {
                testState.headerCount = testState.notificationCount;
                testState.headerRight = options.headerRight;
                if (testState.triggerRender) {
                    testState.triggerRender(function (value) { return value + 1; });
                }
            }
        },
    }); }, useIsFocused: function () { return true; } })); });
jest.mock("@apollo/client", function () {
    var actual = jest.requireActual("@apollo/client");
    return __assign(__assign({}, actual), { useApolloClient: function () { return ({
            refetchQueries: jest.fn(function () {
                updateNotificationCount(testState.notificationCount);
                return Promise.resolve();
            }),
        }); } });
});
jest.mock("@app/graphql/generated", function () {
    var actual = jest.requireActual("@app/graphql/generated");
    return __assign(__assign({}, actual), { useSettingsScreenQuery: jest.fn(function () { return ({
            data: {
                me: {
                    id: "user-id",
                    username: "test1",
                    language: "en",
                    totpEnabled: false,
                    phone: testState.phone,
                    email: {
                        address: "test@example.com",
                        verified: true,
                        __typename: "Email",
                    },
                    defaultAccount: {
                        id: "account-id",
                        defaultWalletId: "btc-wallet-id",
                        wallets: [
                            {
                                id: "btc-wallet-id",
                                balance: 0,
                                walletCurrency: "BTC",
                                __typename: "BTCWallet",
                            },
                            {
                                id: "usd-wallet-id",
                                balance: 0,
                                walletCurrency: "USD",
                                __typename: "UsdWallet",
                            },
                        ],
                        __typename: "ConsumerAccount",
                    },
                    __typename: "User",
                },
            },
            loading: false,
        }); }), useUnacknowledgedNotificationCountQuery: jest.fn(function () { return ({
            data: {
                me: {
                    id: "user-id",
                    unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount: testState.notificationCount,
                },
            },
        }); }), useStatefulNotificationsQuery: jest.fn(function () { return ({
            data: {
                me: {
                    statefulNotificationsWithoutBulletinEnabled: {
                        nodes: testState.notificationNodes,
                        pageInfo: {
                            endCursor: null,
                            hasNextPage: false,
                            hasPreviousPage: false,
                            startCursor: null,
                        },
                    },
                },
            },
            loading: false,
            fetchMore: jest.fn(),
            refetch: jest.fn(),
        }); }), useStatefulNotificationAcknowledgeMutation: jest.fn(function (_options) {
            var ack = jest.fn(function () {
                updateNotificationCount(Math.max(testState.notificationCount - 1, 0));
                return Promise.resolve();
            });
            return [ack, { loading: false }];
        }) });
});
var mocksWithUsername = __spreadArray(__spreadArray([], mocks, true), [
    {
        request: {
            query: SettingsScreenDocument,
        },
        result: {
            data: {
                me: {
                    id: "70df9822-efe0-419c-b864-c9efa99872ea",
                    phone: "+50365055539",
                    username: "test1",
                    language: "en",
                    defaultAccount: {
                        id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        displayCurrency: "EN",
                        defaultWalletId: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
                        __typename: "ConsumerAccount",
                    },
                    __typename: "User",
                },
            },
        },
    },
], false);
describe("Settings Screen", function () {
    beforeEach(function () {
        loadLocale("en");
        testState = createTestState();
    });
    var TestNavigator = function () {
        var _a = React.useState("settings"), screenName = _a[0], setScreenName = _a[1];
        var _b = React.useState(0), setTick = _b[1];
        testState.setActiveScreen = setScreenName;
        testState.triggerRender = setTick;
        return (<View>
        <View testID="notification-header">
          {testState.headerRight ? testState.headerRight() : null}
        </View>
        <SettingsScreen />
        {screenName === "notificationHistory" ? (<View>
            <TouchableOpacity testID="back-to-settings" onPress={function () { return setScreenName("settings"); }}/>
            <NotificationHistoryScreen />
          </View>) : null}
      </View>);
    };
    it("clears the badge after entering the notification history", function () { return __awaiter(void 0, void 0, void 0, function () {
        var header, headerButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <LevelContextProvider value={{
                            isAtLeastLevelZero: true,
                            isAtLeastLevelOne: true,
                            isAtLeastLevelTwo: false,
                            isAtLeastLevelThree: false,
                            currentLevel: AccountLevel.One,
                        }}>
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    header = screen.getByTestId("notification-header");
                    expect(within(header).getByTestId("notification-badge")).toBeTruthy();
                    headerButton = within(header).UNSAFE_getByType(TouchableOpacity);
                    fireEvent.press(headerButton);
                    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory");
                    expect(screen.getByTestId("notification-screen")).toBeTruthy();
                    expect(screen.getAllByText(notificationTitle)).toHaveLength(3);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 2:
                    _a.sent();
                    fireEvent.press(screen.getByTestId("back-to-settings"));
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 3:
                    _a.sent();
                    expect(within(header).queryByTestId("notification-badge")).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("hides the badge when the last unread notification is acknowledged", function () { return __awaiter(void 0, void 0, void 0, function () {
        var header, headerButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updateNotificationCount(1);
                    testState.headerCount = -1;
                    testState.headerRight = null;
                    render(<ContextForScreen>
        <LevelContextProvider value={{
                            isAtLeastLevelZero: true,
                            isAtLeastLevelOne: true,
                            isAtLeastLevelTwo: false,
                            isAtLeastLevelThree: false,
                            currentLevel: AccountLevel.One,
                        }}>
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    header = screen.getByTestId("notification-header");
                    expect(within(header).getByTestId("notification-badge")).toBeTruthy();
                    headerButton = within(header).UNSAFE_getByType(TouchableOpacity);
                    fireEvent.press(headerButton);
                    expect(mockNavigate).toHaveBeenCalledWith("notificationHistory");
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 2:
                    _a.sent();
                    fireEvent.press(screen.getByTestId("back-to-settings"));
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 3:
                    _a.sent();
                    expect(within(header).queryByTestId("notification-badge")).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not render a badge when there are no unread notifications", function () { return __awaiter(void 0, void 0, void 0, function () {
        var header;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updateNotificationCount(0);
                    testState.headerCount = -1;
                    testState.headerRight = null;
                    render(<ContextForScreen>
        <LevelContextProvider value={{
                            isAtLeastLevelZero: true,
                            isAtLeastLevelOne: true,
                            isAtLeastLevelTwo: false,
                            isAtLeastLevelThree: false,
                            currentLevel: AccountLevel.One,
                        }}>
          <TestNavigator />
        </LevelContextProvider>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    header = screen.getByTestId("notification-header");
                    expect(within(header).queryByTestId("notification-badge")).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Renders user info", function () { return __awaiter(void 0, void 0, void 0, function () {
        var elements;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    elements = screen.getAllByText("test1@blink.sv");
                    expect(elements.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows phone ln address when phone is verified", function () { return __awaiter(void 0, void 0, void 0, function () {
        var phone, lnAddress;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    phone = "+50365055539";
                    lnAddress = "".concat(phone, "@blink.sv");
                    testState.phone = phone;
                    render(<ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByText(lnAddress)).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("hides phone ln address when phone is missing", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testState.phone = null;
                    render(<ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(screen.queryByText("Set your lightning address")).toBeNull();
                    expect(screen.queryByText("+50365055539@blink.sv")).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("truncates long settings row titles", function () {
        var longTitle = "This is a very long settings row title that should truncate";
        render(<ContextForScreen>
        <SettingsRow action={null} title={longTitle}/>
      </ContextForScreen>);
        var titleNode = screen.getByText(longTitle);
        expect(titleNode.props.numberOfLines).toBe(1);
        expect(titleNode.props.ellipsizeMode).toBe("tail");
    });
    it("truncates long settings row subtitles", function () {
        var longTitle = "Short title";
        var longSubtitle = "This is a very long subtitle that should truncate";
        render(<ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle}/>
      </ContextForScreen>);
        var subtitleNode = screen.getByText(longSubtitle);
        expect(subtitleNode.props.numberOfLines).toBe(1);
        expect(subtitleNode.props.ellipsizeMode).toBe("tail");
    });
    it("truncates long title and subtitle together", function () {
        var longTitle = "Another very long settings row title that should truncate";
        var longSubtitle = "Another very long subtitle that should truncate";
        render(<ContextForScreen>
        <SettingsRow action={null} title={longTitle} subtitle={longSubtitle}/>
      </ContextForScreen>);
        var titleNode = screen.getByText(longTitle);
        var subtitleNode = screen.getByText(longSubtitle);
        expect(titleNode.props.numberOfLines).toBe(1);
        expect(titleNode.props.ellipsizeMode).toBe("tail");
        expect(subtitleNode.props.numberOfLines).toBe(1);
        expect(subtitleNode.props.ellipsizeMode).toBe("tail");
    });
});
//# sourceMappingURL=settings-screen.spec.js.map