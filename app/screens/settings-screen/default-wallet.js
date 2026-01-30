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
import * as React from "react";
import { View, TouchableOpacity } from "react-native";
import { gql } from "@apollo/client";
import { useAccountUpdateDefaultWalletIdMutation, useSetDefaultWalletScreenQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Divider, Text, makeStyles, useTheme, ListItem, Icon } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { testProps } from "../../utils/testProps";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation accountUpdateDefaultWalletId($input: AccountUpdateDefaultWalletIdInput!) {\n    accountUpdateDefaultWalletId(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        defaultWalletId\n      }\n    }\n  }\n\n  query setDefaultWalletScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  mutation accountUpdateDefaultWalletId($input: AccountUpdateDefaultWalletIdInput!) {\n    accountUpdateDefaultWalletId(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        defaultWalletId\n      }\n    }\n  }\n\n  query setDefaultWalletScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
export var DefaultWalletScreen = function () {
    var _a, _b, _c, _d, _e, _f;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var isAuthed = useIsAuthed();
    var _g = React.useState(""), newDefaultWalletId = _g[0], setNewDefaultWalletId = _g[1];
    var data = useSetDefaultWalletScreenQuery({
        fetchPolicy: "cache-first",
        skip: !isAuthed,
    }).data;
    var btcWallet = getBtcWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets);
    var usdWallet = getUsdWallet((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.wallets);
    var btcWalletId = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.id;
    var usdWalletId = usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.id;
    var defaultWalletId = (_f = (_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.defaultAccount) === null || _f === void 0 ? void 0 : _f.defaultWalletId;
    var _h = useAccountUpdateDefaultWalletIdMutation(), accountUpdateDefaultWallet = _h[0], loading = _h[1].loading;
    if (!usdWalletId || !btcWalletId) {
        return <Text>{"missing walletIds"}</Text>;
    }
    var handleSetDefaultWallet = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (loading)
                        return [2 /*return*/];
                    if (!(id !== defaultWalletId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, accountUpdateDefaultWallet({
                            variables: {
                                input: {
                                    walletId: id,
                                },
                            },
                        })];
                case 1:
                    _a.sent();
                    setNewDefaultWalletId(id);
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    var Wallets = [
        {
            name: LL.common.bitcoin(),
            id: btcWalletId,
        },
        {
            name: LL.common.dollarStablesats(),
            id: usdWalletId,
        },
    ];
    var selectedWalletId = newDefaultWalletId || defaultWalletId || "";
    return (<Screen preset="scroll">
      <View style={styles.walletsContainer}>
        {Wallets.map(function (_a, index) {
            var name = _a.name, id = _a.id;
            var isLast = index === Wallets.length - 1;
            var isSelected = selectedWalletId === id;
            return (<React.Fragment key={id}>
              <Divider color={colors.grey4}/>
              <TouchableOpacity onPress={function () { return handleSetDefaultWallet(id); }} activeOpacity={0.7} {...testProps(name)}>
                <ListItem containerStyle={styles.listItemContainer}>
                  <View>
                    {isSelected ? (<Icon name="checkmark-circle" size={20} color={colors._green} type="ionicon"/>) : (<View style={styles.listSeparator}></View>)}
                  </View>
                  <ListItem.Content>
                    <ListItem.Title style={styles.itemTitle}>
                      <Text type="p2">{name}</Text>
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              </TouchableOpacity>
              {isLast && <Divider color={colors.grey4}/>}
            </React.Fragment>);
        })}
      </View>
      <View style={styles.containerInfo}>
        <GaloyInfo>{LL.DefaultWalletScreen.info()}</GaloyInfo>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        walletsContainer: {
            marginHorizontal: 16,
            marginTop: 16,
        },
        listItemContainer: {
            backgroundColor: colors.transparent,
            paddingVertical: 16,
            paddingHorizontal: 16,
        },
        itemTitle: {
            fontSize: 16,
        },
        containerInfo: {
            marginHorizontal: 20,
            marginTop: 34,
            marginBottom: 32,
        },
        listSeparator: {
            width: 20,
            height: 20,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=default-wallet.js.map