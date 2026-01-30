var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { Screen } from "@app/components/screen";
import { useContactsQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { toastShow } from "@app/utils/toast";
import { useAppConfig } from "@app/hooks";
import { useNavigation } from "@react-navigation/native";
import { SearchBar } from "@rn-vui/base";
import { ListItem, makeStyles, useTheme } from "@rn-vui/themed";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query contacts {\n    me {\n      id\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n"], ["\n  query contacts {\n    me {\n      id\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n"])));
export var AllContactsScreen = function () {
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var lnAddressHostname = useAppConfig().appConfig.galoyInstance.lnAddressHostname;
    var navigation = useNavigation();
    var isAuthed = useIsAuthed();
    var _a = useState([]), matchingContacts = _a[0], setMatchingContacts = _a[1];
    var _b = useState(""), searchText = _b[0], setSearchText = _b[1];
    var LL = useI18nContext().LL;
    var _c = useContactsQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-and-network",
    }), loading = _c.loading, data = _c.data, error = _c.error;
    if (error) {
        toastShow({ message: error.message, LL: LL });
    }
    var contacts = useMemo(function () {
        var _a, _b;
        return (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.contacts.slice()) !== null && _b !== void 0 ? _b : [];
    }, [data]);
    var reset = useCallback(function () {
        setSearchText("");
        setMatchingContacts(contacts);
    }, [contacts]);
    React.useEffect(function () {
        setMatchingContacts(contacts);
    }, [contacts]);
    // This implementation of search will cause a match if any word in the search text
    // matches the contacts name or prettyName.
    var updateMatchingContacts = useCallback(function (newSearchText) {
        setSearchText(newSearchText);
        if (newSearchText.length > 0) {
            var searchWordArray_1 = newSearchText
                .split(" ")
                .filter(function (text) { return text.trim().length > 0; });
            var matchingContacts_1 = contacts.filter(function (contact) {
                return searchWordArray_1.some(function (word) { return wordMatchesContact(word, contact); });
            });
            setMatchingContacts(matchingContacts_1);
        }
        else {
            setMatchingContacts(contacts);
        }
    }, [contacts]);
    var wordMatchesContact = function (searchWord, contact) {
        var contactPrettyNameMatchesSearchWord;
        var contactNameMatchesSearchWord = contact.handle
            .toLowerCase()
            .includes(searchWord.toLowerCase());
        if (contact.alias) {
            contactPrettyNameMatchesSearchWord = contact.alias
                .toLowerCase()
                .includes(searchWord.toLowerCase());
        }
        else {
            contactPrettyNameMatchesSearchWord = false;
        }
        return contactNameMatchesSearchWord || contactPrettyNameMatchesSearchWord;
    };
    var SearchBarContent;
    var ListEmptyContent;
    if (contacts.length > 0) {
        SearchBarContent = (<SearchBar {...testProps(LL.common.search())} placeholder={LL.common.search()} value={searchText} onChangeText={updateMatchingContacts} platform="default" round showLoading={false} containerStyle={styles.searchBarContainer} inputContainerStyle={styles.searchBarInputContainerStyle} inputStyle={styles.searchBarText} rightIconContainerStyle={styles.searchBarRightIconStyle} searchIcon={<Icon name="search" size={24} color={styles.icon.color}/>} clearIcon={<Icon name="close" size={24} onPress={reset} color={styles.icon.color}/>}/>);
    }
    else {
        SearchBarContent = <></>;
    }
    if (contacts.length > 0) {
        ListEmptyContent = (<View style={styles.emptyListNoMatching}>
        <Text style={styles.emptyListTitle}>{LL.PeopleScreen.noMatchingContacts()}</Text>
      </View>);
    }
    else if (loading) {
        ListEmptyContent = (<View style={styles.activityIndicatorContainer}>
        <ActivityIndicator size="large" color={colors.primary}/>
      </View>);
    }
    else {
        ListEmptyContent = (<View style={styles.emptyListNoContacts}>
        <Text {...testProps(LL.PeopleScreen.noContactsTitle())} style={styles.emptyListTitle}>
          {LL.PeopleScreen.noContactsTitle()}
        </Text>
        <Text style={styles.emptyListText}>{LL.PeopleScreen.noContactsYet()}</Text>
      </View>);
    }
    return (<Screen>
      {SearchBarContent}
      <FlatList contentContainerStyle={styles.listContainer} data={matchingContacts} ListEmptyComponent={ListEmptyContent} renderItem={function (_a) {
            var _b, _c;
            var item = _a.item;
            var handle = (_c = (_b = item === null || item === void 0 ? void 0 : item.handle) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
            var displayHandle = handle && !handle.includes("@") ? "".concat(handle, "@").concat(lnAddressHostname) : handle;
            return (<ListItem key={item.handle} style={styles.item} containerStyle={styles.itemContainer} onPress={function () { return navigation.navigate("contactDetail", { contact: item }); }}>
              <Icon name={"person-outline"} size={24} color={colors.primary}/>
              <ListItem.Content>
                <ListItem.Title style={styles.itemText}>{displayHandle}</ListItem.Title>
              </ListItem.Content>
            </ListItem>);
        }} keyExtractor={function (item) { return item.handle; }}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        activityIndicatorContainer: {
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
        },
        emptyListNoContacts: {
            marginHorizontal: 12,
            marginTop: 32,
        },
        emptyListNoMatching: {
            marginHorizontal: 26,
            marginTop: 8,
        },
        emptyListText: {
            fontSize: 18,
            marginTop: 30,
            textAlign: "center",
            color: colors.black,
        },
        emptyListTitle: {
            color: colors.black,
            fontSize: 24,
            fontWeight: "bold",
            textAlign: "center",
        },
        item: {
            marginHorizontal: 32,
            marginVertical: 8,
        },
        itemContainer: {
            borderRadius: 8,
            backgroundColor: colors.grey5,
        },
        listContainer: { flexGrow: 1 },
        searchBarContainer: {
            backgroundColor: colors.white,
            borderBottomColor: colors.white,
            borderTopColor: colors.white,
            marginHorizontal: 26,
            marginVertical: 8,
        },
        searchBarInputContainerStyle: {
            backgroundColor: colors.grey5,
        },
        searchBarRightIconStyle: {
            padding: 8,
        },
        searchBarText: {
            color: colors.black,
            textDecorationLine: "none",
        },
        itemText: { color: colors.black },
        icon: {
            color: colors.black,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=all-contacts.js.map