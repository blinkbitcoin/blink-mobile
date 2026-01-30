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
import { View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { useUserContactUpdateAliasMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme, Input } from "@rn-vui/themed";
import { CloseCross } from "../../../components/close-cross";
import { Screen } from "../../../components/screen";
import { testProps } from "../../../utils/testProps";
import { ContactTransactions } from "./contact-transactions";
export var ContactsDetailScreen = function (_a) {
    var route = _a.route;
    var contact = route.params.contact;
    return <ContactsDetailScreenJSX contact={contact}/>;
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {\n    userContactUpdateAlias(input: $input) {\n      errors {\n        message\n      }\n      contact {\n        alias\n        id\n      }\n    }\n  }\n"], ["\n  mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {\n    userContactUpdateAlias(input: $input) {\n      errors {\n        message\n      }\n      contact {\n        alias\n        id\n      }\n    }\n  }\n"])));
export var ContactsDetailScreenJSX = function (_a) {
    var contact = _a.contact;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var _b = React.useState(contact.alias), contactName = _b[0], setContactName = _b[1];
    var LL = useI18nContext().LL;
    // TODO: feature seems broken. need to fix.
    var userContactUpdateAlias = useUserContactUpdateAliasMutation({})[0];
    var updateName = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!contactName) return [3 /*break*/, 2];
                    return [4 /*yield*/, userContactUpdateAlias({
                            variables: { input: { username: contact.username, alias: contactName } },
                        })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    return (<Screen headerShown={false}>
      <View style={styles.aliasView}>
        <Icon {...testProps("contact-detail-icon")} name="person-outline" size={86} color={colors.black}/>
        <View style={styles.inputContainer}>
          <Input style={styles.alias} inputStyle={styles.inputStyle} inputContainerStyle={{ borderColor: colors.black }} onChangeText={setContactName} onSubmitEditing={updateName} onBlur={updateName} returnKeyType="done">
            {contact.alias}
          </Input>
        </View>
        <Text type="p1">{"".concat(LL.common.username(), ": ").concat(contact.username)}</Text>
      </View>
      <View style={styles.contactBodyContainer}>
        <View style={styles.transactionsView}>
          <Text style={styles.screenTitle}>
            {LL.ContactDetailsScreen.title({
            username: contact.alias || contact.username,
        })}
          </Text>
          <ContactTransactions contactUsername={contact.username}/>
        </View>
        <View style={styles.actionsContainer}>
          <GaloyIconButton name={"send"} size="large" text={LL.HomeScreen.send()} onPress={function () {
            return navigation.navigate("sendBitcoinDestination", {
                username: contact.username,
            });
        }}/>
        </View>
      </View>

      <CloseCross color={colors.black} onPress={navigation.goBack}/>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    actionsContainer: {
        margin: 12,
    },
    alias: {
        fontSize: 36,
    },
    aliasView: {
        alignItems: "center",
        paddingBottom: 6,
        paddingTop: isIos ? 40 : 10,
    },
    contactBodyContainer: {
        flex: 1,
    },
    inputContainer: {
        flexDirection: "row",
    },
    inputStyle: {
        textAlign: "center",
        textDecorationLine: "underline",
    },
    screenTitle: {
        fontSize: 18,
        marginBottom: 12,
        marginTop: 18,
    },
    transactionsView: {
        flex: 1,
        marginHorizontal: 30,
    },
}); });
var templateObject_1;
//# sourceMappingURL=contacts-detail.js.map