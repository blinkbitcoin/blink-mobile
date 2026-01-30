var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { gql } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { useContactsCardQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import { useAppConfig } from "@app/hooks";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text } from "@rn-vui/themed";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query ContactsCard {\n    me {\n      id\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n"], ["\n  query ContactsCard {\n    me {\n      id\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n"])));
var Contact = function (_a) {
    var _b, _c;
    var contact = _a.contact;
    var styles = useStyles();
    var navigation = useNavigation();
    var rootNavigation = navigation.getParent();
    var lnAddressHostname = useAppConfig().appConfig.galoyInstance.lnAddressHostname;
    var handle = (_c = (_b = contact === null || contact === void 0 ? void 0 : contact.handle) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
    var displayHandle = handle && !handle.includes("@") ? "".concat(handle, "@").concat(lnAddressHostname) : handle;
    return (<View style={styles.contactContainer}>
      <Text type="p1">{displayHandle}</Text>
      <GaloyIconButton onPress={function () {
            return rootNavigation.navigate("sendBitcoinDestination", {
                username: contact.handle,
            });
        }} name="send" size="medium" iconOnly/>
    </View>);
};
export var ContactsCard = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var navigation = useNavigation();
    var _a = useContactsCardQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-and-network",
    }), loading = _a.loading, data = _a.data, error = _a.error;
    if (error) {
        toastShow({ message: error.message, LL: LL });
    }
    var contacts = useMemo(function () { return (data ? getFrequentContacts(data) : []); }, [data]);
    return (<View style={styles.container}>
      <View>
        <View style={styles.contacts}>
          <Text type="h2">{LL.PeopleScreen.frequentContacts()}</Text>
        </View>
        <View style={[styles.separator, styles.spaceTop]}></View>
      </View>
      {loading ? (<ActivityIndicator />) : contacts.length === 0 ? (<Text type="p2">{LL.PeopleScreen.noContactsTitle()}</Text>) : (<>
          <View style={styles.contactsOuterContainer}>
            {contacts.map(function (contact) { return (<Contact key={contact.id} contact={contact}/>); })}
          </View>
          <GaloySecondaryButton title={LL.PeopleScreen.viewAllContacts()} onPress={function () { return navigation.navigate("allContacts"); }}/>
        </>)}
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "column",
            marginBottom: 20,
            borderRadius: 12,
            padding: 12,
            justifyContent: "center",
            rowGap: 14,
        },
        contacts: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        separator: {
            height: 1,
            backgroundColor: colors.grey4,
        },
        spaceTop: {
            marginTop: 8,
        },
        textCenter: {
            textAlign: "center",
        },
        contactsOuterContainer: {
            display: "flex",
            flexDirection: "column",
            rowGap: 10,
        },
        contactContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 3,
        },
    });
});
// ---- HELPERS ----
var getFrequentContacts = function (data) {
    var _a;
    // Extract the contacts
    var _contacts = ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.contacts) || [];
    var contacts = __spreadArray([], _contacts, true); // Convert from readyonlyarray to regular array
    // Sort contacts by the `transactionsCount` in descending order
    contacts.sort(function (a, b) {
        return b.transactionsCount - a.transactionsCount;
    });
    // return top 3
    return contacts.slice(0, 3);
};
var templateObject_1;
//# sourceMappingURL=contacts-card.js.map