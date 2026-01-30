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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as React from "react";
import { gql } from "@apollo/client";
import { NotificationChannel, useAccountDisableNotificationCategoryMutation, useAccountEnableNotificationCategoryMutation, useNotificationSettingsQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { ListItem, makeStyles, Text } from "@rn-vui/themed";
import { Screen } from "@app/components/screen";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { Switch } from "@app/components/atomic/switch";
import { SettingsGroup } from "./group";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query notificationSettings {\n    me {\n      id\n      defaultAccount {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountEnableNotificationChannel(\n    $input: AccountEnableNotificationChannelInput!\n  ) {\n    accountEnableNotificationChannel(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountDisableNotificationChannel(\n    $input: AccountDisableNotificationChannelInput!\n  ) {\n    accountDisableNotificationChannel(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountEnableNotificationCategory(\n    $input: AccountEnableNotificationCategoryInput!\n  ) {\n    accountEnableNotificationCategory(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountDisableNotificationCategory(\n    $input: AccountDisableNotificationCategoryInput!\n  ) {\n    accountDisableNotificationCategory(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query notificationSettings {\n    me {\n      id\n      defaultAccount {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountEnableNotificationChannel(\n    $input: AccountEnableNotificationChannelInput!\n  ) {\n    accountEnableNotificationChannel(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountDisableNotificationChannel(\n    $input: AccountDisableNotificationChannelInput!\n  ) {\n    accountDisableNotificationChannel(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountEnableNotificationCategory(\n    $input: AccountEnableNotificationCategoryInput!\n  ) {\n    accountEnableNotificationCategory(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n\n  mutation accountDisableNotificationCategory(\n    $input: AccountDisableNotificationCategoryInput!\n  ) {\n    accountDisableNotificationCategory(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        notificationSettings {\n          push {\n            enabled\n            disabledCategories\n          }\n        }\n      }\n    }\n  }\n"])));
var NotificationCategories = {
    Payments: "Payments",
    Circles: "Circles",
    Price: "Price",
    Marketing: "Marketing",
};
var CategoryIcons = {
    Payments: "receive",
    Circles: "people",
    Price: "graph",
    Marketing: "upgrade",
};
export var NotificationSettingsScreen = function () {
    var _a, _b, _c, _d;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var isAuthed = useIsAuthed();
    var data = useNotificationSettingsQuery({
        fetchPolicy: "cache-first",
        skip: !isAuthed,
    }).data;
    var accountId = (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.id;
    var notificationSettings = (_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.notificationSettings;
    var enableNotificationCategory = useAccountEnableNotificationCategoryMutation({
        optimisticResponse: accountId && notificationSettings
            ? function (vars) {
                return optimisticEnableCategoryResponse({
                    notificationSettings: notificationSettings,
                    accountId: accountId,
                    category: vars.input.category,
                });
            }
            : undefined,
    })[0];
    var disableNotificationCategory = useAccountDisableNotificationCategoryMutation({
        optimisticResponse: accountId && notificationSettings
            ? function (vars) {
                return optimisticDisableCategoryResponse({
                    notificationSettings: notificationSettings,
                    accountId: accountId,
                    category: vars.input.category,
                });
            }
            : undefined,
    })[0];
    var pushNotificationCategoryEnabled = function (category) {
        return !(notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.push.disabledCategories.includes(category));
    };
    var toggleCategory = function (category, enabled, channel) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!enabled) return [3 /*break*/, 2];
                    return [4 /*yield*/, enableNotificationCategory({
                            variables: {
                                input: {
                                    category: category,
                                    channel: channel,
                                },
                            },
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, disableNotificationCategory({
                        variables: {
                            input: {
                                category: category,
                                channel: channel,
                            },
                        },
                    })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var categoriesArray = Object.values(NotificationCategories);
    var NotificationRow = function (_a) {
        var category = _a.category;
        return (<ListItem containerStyle={styles.listItemContainer}>
      <GaloyIcon name={CategoryIcons[category]} size={24}/>
      <ListItem.Content>
        <ListItem.Title>
          <Text type="p2">
            {LL.NotificationSettingsScreen.notificationCategories[category].title()}
          </Text>
        </ListItem.Title>
      </ListItem.Content>
      <Switch value={pushNotificationCategoryEnabled(category)} onValueChange={function (value) {
                return toggleCategory(category, value, NotificationChannel.Push);
            }}/>
    </ListItem>);
    };
    NotificationRow.displayName = "NotificationRow";
    var pushNotificationSettings = categoriesArray.map(function (category) {
        var NotificationRowWithCategory = function () { return (<NotificationRow category={category}/>); };
        NotificationRowWithCategory.displayName = "NotificationRow-".concat(category);
        return NotificationRowWithCategory;
    });
    return (<Screen style={styles.container} preset="scroll">
      <SettingsGroup items={pushNotificationSettings}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            paddingHorizontal: 12,
            paddingVertical: 20,
        },
        listItemContainer: {
            backgroundColor: colors.transparent,
        },
    });
});
var optimisticEnableCategoryResponse = function (_a) {
    var notificationSettings = _a.notificationSettings, accountId = _a.accountId, category = _a.category;
    return {
        accountEnableNotificationCategory: {
            account: {
                id: accountId,
                notificationSettings: {
                    push: {
                        enabled: true,
                        disabledCategories: notificationSettings.push.disabledCategories.filter(function (c) { return c !== category; }),
                        __typename: "NotificationChannelSettings",
                    },
                    __typename: "NotificationSettings",
                },
                __typename: "ConsumerAccount",
            },
            errors: [],
            __typename: "AccountUpdateNotificationSettingsPayload",
        },
        __typename: "Mutation",
    };
};
var optimisticDisableCategoryResponse = function (_a) {
    var notificationSettings = _a.notificationSettings, accountId = _a.accountId, category = _a.category;
    return {
        accountDisableNotificationCategory: {
            account: {
                id: accountId,
                notificationSettings: {
                    push: {
                        enabled: true,
                        disabledCategories: __spreadArray(__spreadArray([], notificationSettings.push.disabledCategories, true), [
                            category,
                        ], false),
                        __typename: "NotificationChannelSettings",
                    },
                    __typename: "NotificationSettings",
                },
                __typename: "ConsumerAccount",
            },
            errors: [],
            __typename: "AccountUpdateNotificationSettingsPayload",
        },
        __typename: "Mutation",
    };
};
var templateObject_1;
//# sourceMappingURL=notifications-screen.js.map