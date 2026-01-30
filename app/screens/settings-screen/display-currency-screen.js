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
import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select";
import { RealtimePriceDocument, useAccountUpdateDisplayCurrencyMutation, useCurrencyListQuery, useDisplayCurrencyQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { makeStyles, SearchBar, Text } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation accountUpdateDisplayCurrency($input: AccountUpdateDisplayCurrencyInput!) {\n    accountUpdateDisplayCurrency(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        displayCurrency\n      }\n    }\n  }\n"], ["\n  mutation accountUpdateDisplayCurrency($input: AccountUpdateDisplayCurrencyInput!) {\n    accountUpdateDisplayCurrency(input: $input) {\n      errors {\n        message\n      }\n      account {\n        id\n        displayCurrency\n      }\n    }\n  }\n"])));
export var DisplayCurrencyScreen = function () {
    var _a, _b;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var dataAuthed = useDisplayCurrencyQuery({ skip: !isAuthed }).data;
    var displayCurrency = (_b = (_a = dataAuthed === null || dataAuthed === void 0 ? void 0 : dataAuthed.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.displayCurrency;
    var updateDisplayCurrency = useAccountUpdateDisplayCurrencyMutation()[0];
    var _c = useCurrencyListQuery({
        fetchPolicy: "cache-and-network",
        skip: !isAuthed,
    }), data = _c.data, loading = _c.loading;
    var _d = React.useState(""), newCurrency = _d[0], setNewCurrency = _d[1];
    var _e = React.useState(""), searchText = _e[0], setSearchText = _e[1];
    var _f = React.useState([]), matchingCurrencies = _f[0], setMatchingCurrencies = _f[1];
    var reset = function () {
        var _a, _b;
        setSearchText("");
        setMatchingCurrencies((_b = (_a = data === null || data === void 0 ? void 0 : data.currencyList) === null || _a === void 0 ? void 0 : _a.slice()) !== null && _b !== void 0 ? _b : []);
    };
    React.useEffect(function () {
        (data === null || data === void 0 ? void 0 : data.currencyList) && setMatchingCurrencies(data.currencyList.slice());
    }, [data === null || data === void 0 ? void 0 : data.currencyList]);
    var updateMatchingCurrency = useCallback(function (newSearchText) {
        if (!(data === null || data === void 0 ? void 0 : data.currencyList)) {
            return;
        }
        setSearchText(newSearchText);
        var currencies = data.currencyList.slice();
        var matchSearch = getMatchingCurrencies(newSearchText, currencies);
        var currencyWithSearch = newSearchText.length > 0 ? matchSearch : currencies;
        // make sure the display currency is always in the list
        if (!currencyWithSearch.find(function (c) { return c.id === displayCurrency; })) {
            var currency = currencies.find(function (c) { return c.id === displayCurrency; });
            currency && currencyWithSearch.push(currency);
        }
        // sort to make sure selection currency always on top
        currencyWithSearch.sort(function (a, b) {
            if (a.id === displayCurrency) {
                return -1;
            }
            if (b.id === displayCurrency) {
                return 1;
            }
            return 0;
        });
        setMatchingCurrencies(currencyWithSearch);
    }, [data === null || data === void 0 ? void 0 : data.currencyList, displayCurrency]);
    if (loading) {
        return (<View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>);
    }
    if (!(data === null || data === void 0 ? void 0 : data.currencyList)) {
        return <Text>{LL.DisplayCurrencyScreen.errorLoading()}</Text>;
    }
    var handleCurrencyChange = function (currencyId) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (loading)
                        return [2 /*return*/];
                    return [4 /*yield*/, updateDisplayCurrency({
                            variables: { input: { currency: currencyId } },
                            refetchQueries: [RealtimePriceDocument],
                        })];
                case 1:
                    _a.sent();
                    setNewCurrency(currencyId);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<Screen preset="scroll">
      <SearchBar {...testProps(LL.common.search())} placeholder={LL.common.search()} value={searchText} onChangeText={updateMatchingCurrency} platform="default" round showLoading={false} containerStyle={styles.searchBarContainer} inputContainerStyle={styles.searchBarInputContainerStyle} inputStyle={styles.searchBarText} rightIconContainerStyle={styles.searchBarRightIconStyle} searchIcon={<Icon name="search" size={24}/>} clearIcon={<Icon name="close" size={24} onPress={reset}/>}/>
      <MenuSelect value={newCurrency || displayCurrency || ""} onChange={handleCurrencyChange}>
        {matchingCurrencies.map(function (currency) { return (<MenuSelectItem key={currency.id} value={currency.id}>
            {currency.id} - {currency.name} {currency.flag && "- ".concat(currency.flag)}
          </MenuSelectItem>); })}
      </MenuSelect>
    </Screen>);
};
export var wordMatchesCurrency = function (searchWord, currency) {
    var matchForName = currency.name.toLowerCase().includes(searchWord.toLowerCase());
    var matchForId = currency.id.toLowerCase().includes(searchWord.toLowerCase());
    return matchForName || matchForId;
};
export var getMatchingCurrencies = function (searchText, currencies) {
    var searchWordArray = searchText.split(" ").filter(function (text) { return text.trim().length > 0; });
    return currencies.filter(function (currency) {
        return searchWordArray.some(function (word) { return wordMatchesCurrency(word, currency); });
    });
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
        searchBarContainer: {
            backgroundColor: colors.white,
            borderBottomWidth: 0,
            borderTopWidth: 0,
            marginHorizontal: 26,
            marginVertical: 8,
            paddingTop: 8,
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
    });
});
var templateObject_1;
//# sourceMappingURL=display-currency-screen.js.map