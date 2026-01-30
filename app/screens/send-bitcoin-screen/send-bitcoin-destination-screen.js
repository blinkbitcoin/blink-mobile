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
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState, } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { Screen } from "@app/components/screen";
import { LNURL_DOMAINS } from "@app/config";
import { useAppConfig } from "@app/hooks";
import { useAccountDefaultWalletLazyQuery, useRealtimePriceQuery, useSendBitcoinDestinationQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { logParseDestinationResult } from "@app/utils/analytics";
import { toastShow } from "@app/utils/toast";
import { PaymentType } from "@blinkbitcoin/blink-client";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { useNavigation } from "@react-navigation/native";
import { SearchBar } from "@rn-vui/base";
import { makeStyles, useTheme, Text, ListItem } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { ConfirmDestinationModal } from "./confirm-destination-modal";
import { DestinationInformation } from "./destination-information";
import { parseDestination } from "./payment-destination";
import { DestinationDirection, InvalidDestinationReason, } from "./payment-destination/index.types";
import { DestinationState, SendBitcoinActions, sendBitcoinDestinationReducer, } from "./send-bitcoin-reducer";
import { PhoneInput } from "@app/components/phone-input";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { normalizeString } from "@app/utils/helper";
import { isPhoneNumber, parseValidPhoneNumber } from "@app/utils/phone";
import { isInt } from "validator";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query sendBitcoinDestination {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n        }\n      }\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n\n  query accountDefaultWallet($walletCurrency: WalletCurrency, $username: Username!) {\n    accountDefaultWallet(walletCurrency: $walletCurrency, username: $username) {\n      id\n    }\n  }\n"], ["\n  query sendBitcoinDestination {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n        }\n      }\n      contacts {\n        id\n        handle\n        username\n        alias\n        transactionsCount\n      }\n    }\n  }\n\n  query accountDefaultWallet($walletCurrency: WalletCurrency, $username: Username!) {\n    accountDefaultWallet(walletCurrency: $walletCurrency, username: $username) {\n      id\n    }\n  }\n"])));
export var defaultDestinationState = {
    unparsedDestination: "",
    destinationState: DestinationState.Entering,
};
var InputType = {
    Search: "search",
    Phone: "phone",
};
var wordMatchesContact = function (searchWord, contact) {
    var contactPrettyNameMatchesSearchWord;
    var contactNameMatchesSearchWord = contact.handle
        .toLowerCase()
        .includes(searchWord.toLowerCase());
    if (contact.handle) {
        contactPrettyNameMatchesSearchWord = contact.handle
            .toLowerCase()
            .includes(searchWord.toLowerCase());
    }
    else {
        contactPrettyNameMatchesSearchWord = false;
    }
    return contactNameMatchesSearchWord || contactPrettyNameMatchesSearchWord;
};
var matchCheck = function (newSearchText, allContacts, activeInput) {
    var baseContacts = activeInput === InputType.Phone
        ? allContacts.filter(function (contact) { return isPhoneNumber(contact.handle); })
        : allContacts;
    if (newSearchText.length === 0) {
        return baseContacts;
    }
    var searchWordArray = newSearchText
        .split(" ")
        .filter(function (text) { return text.trim().length > 0; });
    return baseContacts.filter(function (contact) {
        return searchWordArray.some(function (word) { return wordMatchesContact(word, contact); });
    });
};
var SendBitcoinDestinationScreen = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var route = _a.route;
    var styles = usestyles();
    var colors = useTheme().theme.colors;
    var navigation = useNavigation();
    var isAuthed = useIsAuthed();
    var _h = useReducer(sendBitcoinDestinationReducer, defaultDestinationState), destinationState = _h[0], dispatchDestinationStateAction = _h[1];
    var activeInputRef = useRef(InputType.Search);
    var _j = useState(""), rawPhoneNumber = _j[0], setRawPhoneNumber = _j[1];
    var _k = useState(true), keepCountryCode = _k[0], setKeepCountryCode = _k[1];
    var _l = useState(null), defaultPhoneInputInfo = _l[0], setDefaultPhoneInputInfo = _l[1];
    var _m = React.useState(false), goToNextScreenWhenValid = _m[0], setGoToNextScreenWhenValid = _m[1];
    var _o = useSendBitcoinDestinationQuery({
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
        skip: !isAuthed,
    }), loading = _o.loading, data = _o.data;
    // forcing price refresh
    useRealtimePriceQuery({
        fetchPolicy: "network-only",
        skip: !isAuthed,
    });
    var wallets = useMemo(function () { var _a; return (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.wallets; }, [(_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount.wallets]);
    var bitcoinNetwork = useMemo(function () { var _a; return (_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.network; }, [(_c = data === null || data === void 0 ? void 0 : data.globals) === null || _c === void 0 ? void 0 : _c.network]);
    var contacts = useMemo(function () { var _a, _b; return (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.contacts) !== null && _b !== void 0 ? _b : []; }, [(_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.contacts]);
    var contactHandleSet = useMemo(function () { return new Set(contacts.map(function (contact) { return normalizeString(contact.handle); })); }, [contacts]);
    var LL = useI18nContext().LL;
    var accountDefaultWalletQuery = useAccountDefaultWalletLazyQuery({
        fetchPolicy: "no-cache",
    })[0];
    var _p = useState([]), matchingContacts = _p[0], setMatchingContacts = _p[1];
    var allContacts = useMemo(function () {
        var _a;
        return ((_a = contacts.slice()) !== null && _a !== void 0 ? _a : []).sort(function (a, b) {
            return b.transactionsCount - a.transactionsCount;
        });
    }, [contacts]);
    var lnAddressHostname = useAppConfig().appConfig.galoyInstance.lnAddressHostname;
    var _q = useState(""), selectedId = _q[0], setSelectedId = _q[1];
    var handleSelection = useCallback(function (id) {
        setSelectedId(function (currentId) { return (currentId === id ? "" : id); });
    }, []);
    var ListEmptyContent;
    if (loading) {
        ListEmptyContent = (<View style={styles.activityIndicatorContainer}>
        <ActivityIndicator size="large" color={colors.primary}/>
      </View>);
    }
    else if (
    // TODO: refactor: ideally this should come from destinationState.destination
    // but currently this is not validated when the user is typing,
    // only validated on paste, or when the user is pressing the send button
    // so there is no way to dynamically know if this is a bitcoin or lightning or lnurl
    // until a refactor is done
    destinationState.unparsedDestination.startsWith("bc1") ||
        destinationState.unparsedDestination.startsWith("tb1") ||
        destinationState.unparsedDestination.startsWith("lnurl") ||
        destinationState.unparsedDestination.startsWith("lightning:") ||
        destinationState.unparsedDestination.startsWith("bitcoin:") ||
        destinationState.unparsedDestination.startsWith("1") ||
        destinationState.unparsedDestination.startsWith("3") ||
        destinationState.unparsedDestination.startsWith("lnbc1") ||
        // if the user is typing a lightning address
        // ideally we should filter from the rules below contact from the same instance
        // ie: test and test@blink.sv are the same user
        // but anyhow, more refactor is needed for contacts to have extenral contacts
        destinationState.unparsedDestination.includes("@")) {
        ListEmptyContent = <></>;
    }
    else if (allContacts.length > 0) {
        ListEmptyContent = <></>;
    }
    else {
        ListEmptyContent = <></>;
    }
    var updateMatchingContacts = useCallback(function (newSearchText) {
        var matching = matchCheck(newSearchText, allContacts, activeInputRef.current);
        setMatchingContacts(matching);
    }, [allContacts]);
    var reset = useCallback(function () {
        dispatchDestinationStateAction({
            type: "set-unparsed-destination",
            payload: { unparsedDestination: "" },
        });
        setGoToNextScreenWhenValid(false);
        setSelectedId("");
        updateMatchingContacts("");
    }, [updateMatchingContacts]);
    var willInitiateValidation = useCallback(function () {
        if (!bitcoinNetwork || !wallets || !contacts) {
            return false;
        }
        dispatchDestinationStateAction({
            type: SendBitcoinActions.SetValidating,
            payload: {},
        });
        return true;
    }, [bitcoinNetwork, wallets, contacts]);
    var parseValidPhone = useCallback(function (input) {
        if (!defaultPhoneInputInfo)
            return null;
        return parseValidPhoneNumber(input, defaultPhoneInputInfo.countryCode);
    }, [defaultPhoneInputInfo]);
    var validateDestination = useCallback(function (rawInput) { return __awaiter(void 0, void 0, void 0, function () {
        var isValidPhone, destination, normalizedHandle, hasConfirmedUsername, identifier, normalizedHandle, hasConfirmedUsername;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // extra check for typescript even though these were checked in willInitiateValidation
                    if (!bitcoinNetwork || !wallets || !contacts) {
                        return [2 /*return*/];
                    }
                    isValidPhone = parseValidPhone(rawInput);
                    if (activeInputRef.current === InputType.Phone) {
                        if (!(isValidPhone === null || isValidPhone === void 0 ? void 0 : isValidPhone.isValid())) {
                            dispatchDestinationStateAction({
                                type: SendBitcoinActions.SetPhoneInvalid,
                                payload: {},
                            });
                            return [2 /*return*/];
                        }
                    }
                    if (activeInputRef.current === InputType.Search) {
                        if ((isValidPhone === null || isValidPhone === void 0 ? void 0 : isValidPhone.isValid()) || isInt(rawInput)) {
                            dispatchDestinationStateAction({
                                type: SendBitcoinActions.SetPhoneNotAllowed,
                                payload: {},
                            });
                            return [2 /*return*/];
                        }
                    }
                    return [4 /*yield*/, parseDestination({
                            rawInput: rawInput,
                            myWalletIds: wallets.map(function (wallet) { return wallet.id; }),
                            bitcoinNetwork: bitcoinNetwork,
                            lnurlDomains: __spreadArray([lnAddressHostname], LNURL_DOMAINS, true),
                            accountDefaultWalletQuery: accountDefaultWalletQuery,
                        })];
                case 1:
                    destination = _c.sent();
                    logParseDestinationResult(destination);
                    if (destination.valid === false) {
                        if (destination.invalidReason === InvalidDestinationReason.SelfPayment) {
                            dispatchDestinationStateAction({
                                type: SendBitcoinActions.SetUnparsedDestination,
                                payload: {
                                    unparsedDestination: rawInput,
                                },
                            });
                            navigation.navigate("conversionDetails");
                            return [2 /*return*/];
                        }
                        dispatchDestinationStateAction({
                            type: SendBitcoinActions.SetInvalid,
                            payload: {
                                invalidDestination: destination,
                                unparsedDestination: rawInput,
                            },
                        });
                        return [2 /*return*/];
                    }
                    if (destination.destinationDirection === DestinationDirection.Send &&
                        destination.validDestination.paymentType === PaymentType.Intraledger) {
                        normalizedHandle = normalizeString(destination.validDestination.handle);
                        hasConfirmedUsername = normalizeString((_a = destinationState.confirmationUsernameType) === null || _a === void 0 ? void 0 : _a.username) ===
                            normalizedHandle && destinationState.unparsedDestination === rawInput;
                        if (!contactHandleSet.has(normalizedHandle) && !hasConfirmedUsername) {
                            dispatchDestinationStateAction({
                                type: SendBitcoinActions.SetRequiresUsernameConfirmation,
                                payload: {
                                    validDestination: destination,
                                    unparsedDestination: rawInput,
                                    confirmationUsernameType: {
                                        type: "new-username",
                                        username: destination.validDestination.handle,
                                    },
                                },
                            });
                            return [2 /*return*/];
                        }
                    }
                    if (destination.destinationDirection === DestinationDirection.Send &&
                        destination.validDestination.paymentType === PaymentType.Lnurl &&
                        activeInputRef.current === InputType.Phone) {
                        identifier = destination.validDestination.lnurlParams.identifier;
                        normalizedHandle = normalizeString(identifier);
                        hasConfirmedUsername = normalizeString((_b = destinationState.confirmationUsernameType) === null || _b === void 0 ? void 0 : _b.username) ===
                            normalizedHandle && destinationState.unparsedDestination === rawInput;
                        if (!contactHandleSet.has(normalizedHandle) && !hasConfirmedUsername) {
                            dispatchDestinationStateAction({
                                type: SendBitcoinActions.SetRequiresUsernameConfirmation,
                                payload: {
                                    validDestination: destination,
                                    unparsedDestination: rawInput,
                                    confirmationUsernameType: {
                                        type: "new-username",
                                        username: identifier,
                                    },
                                },
                            });
                            return [2 /*return*/];
                        }
                    }
                    dispatchDestinationStateAction({
                        type: SendBitcoinActions.SetValid,
                        payload: {
                            validDestination: destination,
                            unparsedDestination: rawInput,
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); }, [
        navigation,
        accountDefaultWalletQuery,
        dispatchDestinationStateAction,
        destinationState,
        contactHandleSet,
        bitcoinNetwork,
        wallets,
        contacts,
        parseValidPhone,
        lnAddressHostname,
    ]);
    var handleChangeText = useCallback(function (newDestination) {
        dispatchDestinationStateAction({
            type: SendBitcoinActions.SetUnparsedDestination,
            payload: { unparsedDestination: newDestination },
        });
        setGoToNextScreenWhenValid(false);
    }, [dispatchDestinationStateAction, setGoToNextScreenWhenValid]);
    useEffect(function () {
        var filteredContacts = matchCheck("", allContacts, activeInputRef.current);
        setMatchingContacts(filteredContacts);
    }, [allContacts]);
    useEffect(function () {
        var _a, _b;
        if (destinationState.destinationState === DestinationState.Entering) {
            setSelectedId("");
        }
        if (!goToNextScreenWhenValid ||
            destinationState.destinationState !== DestinationState.Valid) {
            return;
        }
        if (((_a = destinationState === null || destinationState === void 0 ? void 0 : destinationState.destination) === null || _a === void 0 ? void 0 : _a.destinationDirection) === DestinationDirection.Send) {
            setGoToNextScreenWhenValid(false);
            navigation.navigate("sendBitcoinDetails", {
                paymentDestination: destinationState.destination,
            });
            return;
        }
        if (((_b = destinationState === null || destinationState === void 0 ? void 0 : destinationState.destination) === null || _b === void 0 ? void 0 : _b.destinationDirection) === DestinationDirection.Receive) {
            setGoToNextScreenWhenValid(false);
            navigation.navigate("redeemBitcoinDetail", {
                receiveDestination: destinationState.destination,
            });
        }
    }, [destinationState, goToNextScreenWhenValid, navigation, setGoToNextScreenWhenValid]);
    // setTimeout here allows for the main JS thread to update the UI before the long validateDestination call
    var waitAndValidateDestination = useCallback(function (input) {
        setTimeout(function () { return validateDestination(input); }, 0);
    }, [validateDestination]);
    var initiateGoToNextScreen = useCallback(function (input) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (willInitiateValidation()) {
                setGoToNextScreenWhenValid(true);
                waitAndValidateDestination(input);
            }
            return [2 /*return*/];
        });
    }); }, [willInitiateValidation, waitAndValidateDestination]);
    var resetInput = useCallback(function () {
        reset();
        setDefaultPhoneInputInfo(null);
        setRawPhoneNumber("");
    }, [reset]);
    var onFocusedInput = useCallback(function (inputType) {
        if (activeInputRef.current === inputType)
            return;
        activeInputRef.current = inputType;
        resetInput();
    }, [resetInput]);
    useEffect(function () {
        var _a, _b, _c, _d;
        if ((_a = route.params) === null || _a === void 0 ? void 0 : _a.payment) {
            var text = (_b = route.params) === null || _b === void 0 ? void 0 : _b.payment;
            var isPhoneNumberValid = parseValidPhone(text);
            if (isPhoneNumberValid && (isPhoneNumberValid === null || isPhoneNumberValid === void 0 ? void 0 : isPhoneNumberValid.isValid())) {
                onFocusedInput(InputType.Phone);
                setRawPhoneNumber(isPhoneNumberValid.number);
                return;
            }
            onFocusedInput(InputType.Search);
            handleChangeText((_c = route.params) === null || _c === void 0 ? void 0 : _c.payment);
            initiateGoToNextScreen((_d = route.params) === null || _d === void 0 ? void 0 : _d.payment);
        }
    }, [
        (_e = route.params) === null || _e === void 0 ? void 0 : _e.payment,
        initiateGoToNextScreen,
        handleChangeText,
        onFocusedInput,
        parseValidPhone,
    ]);
    useEffect(function () {
        var _a, _b, _c;
        // If we scan a QR code encoded with a payment url for a specific user e.g. https://{domain}/{username}
        // then we want to detect the username as the destination
        if ((_a = route.params) === null || _a === void 0 ? void 0 : _a.username) {
            var text = (_b = route.params) === null || _b === void 0 ? void 0 : _b.username;
            var isPhoneNumberValid = parseValidPhone(text);
            if (isPhoneNumberValid && (isPhoneNumberValid === null || isPhoneNumberValid === void 0 ? void 0 : isPhoneNumberValid.isValid())) {
                onFocusedInput(InputType.Phone);
                setRawPhoneNumber(isPhoneNumberValid.number);
                return;
            }
            onFocusedInput(InputType.Search);
            handleChangeText((_c = route.params) === null || _c === void 0 ? void 0 : _c.username);
        }
    }, [(_f = route.params) === null || _f === void 0 ? void 0 : _f.username, handleChangeText, onFocusedInput, parseValidPhone]);
    var handleScanPress = useCallback(function () {
        setSelectedId("");
        navigation.setParams({ scanPressed: undefined });
        dispatchDestinationStateAction({
            type: SendBitcoinActions.SetUnparsedDestination,
            payload: { unparsedDestination: "" },
        });
        navigation.navigate("scanningQRCode");
    }, [navigation]);
    useEffect(function () {
        var _a;
        if ((_a = route.params) === null || _a === void 0 ? void 0 : _a.scanPressed) {
            handleScanPress();
        }
    }, [(_g = route.params) === null || _g === void 0 ? void 0 : _g.scanPressed, handleScanPress]);
    var handlePaste = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var clipboard, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (destinationState.destinationState === DestinationState.Validating)
                        return [2 /*return*/];
                    onFocusedInput(InputType.Search);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Clipboard.getString()];
                case 2:
                    clipboard = _a.sent();
                    updateMatchingContacts(clipboard);
                    dispatchDestinationStateAction({
                        type: SendBitcoinActions.SetUnparsedPastedDestination,
                        payload: {
                            unparsedDestination: clipboard,
                        },
                    });
                    if (willInitiateValidation()) {
                        waitAndValidateDestination(clipboard);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                    }
                    toastShow({
                        type: "error",
                        message: function (translations) {
                            return translations.SendBitcoinDestinationScreen.clipboardError();
                        },
                        LL: LL,
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [
        destinationState.destinationState,
        onFocusedInput,
        updateMatchingContacts,
        willInitiateValidation,
        waitAndValidateDestination,
        LL,
    ]);
    var handleContactPress = useCallback(function (item) { return __awaiter(void 0, void 0, void 0, function () {
        var handle, displayHandle, parsePhone, international;
        var _a, _b;
        return __generator(this, function (_c) {
            if (destinationState.destinationState === DestinationState.Validating)
                return [2 /*return*/];
            handle = (_b = (_a = item === null || item === void 0 ? void 0 : item.handle) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
            displayHandle = handle && !handle.includes("@") ? "".concat(handle, "@").concat(lnAddressHostname) : handle;
            parsePhone = parseValidPhone(displayHandle);
            if ((parsePhone === null || parsePhone === void 0 ? void 0 : parsePhone.isValid()) && activeInputRef.current === InputType.Search) {
                onFocusedInput(InputType.Phone);
            }
            updateMatchingContacts(handle);
            handleSelection(item.id);
            if (activeInputRef.current === InputType.Phone) {
                setKeepCountryCode(false);
                international = parsePhone === null || parsePhone === void 0 ? void 0 : parsePhone.number;
                dispatchDestinationStateAction({
                    type: SendBitcoinActions.SetUnparsedDestination,
                    payload: { unparsedDestination: international || displayHandle },
                });
                initiateGoToNextScreen(international || displayHandle);
                setRawPhoneNumber(international || displayHandle);
                setTimeout(function () {
                    setKeepCountryCode(true);
                }, 100);
                return [2 /*return*/];
            }
            dispatchDestinationStateAction({
                type: SendBitcoinActions.SetUnparsedDestination,
                payload: { unparsedDestination: displayHandle },
            });
            initiateGoToNextScreen(displayHandle);
            return [2 /*return*/];
        });
    }); }, [
        destinationState.destinationState,
        lnAddressHostname,
        parseValidPhone,
        onFocusedInput,
        updateMatchingContacts,
        handleSelection,
        initiateGoToNextScreen,
        setKeepCountryCode,
        setRawPhoneNumber,
    ]);
    var inputContainerStyle = useMemo(function () {
        switch (destinationState.destinationState) {
            case DestinationState.Validating:
                return styles.enteringInputContainer;
            case DestinationState.Invalid:
                return styles.errorInputContainer;
            case DestinationState.RequiresUsernameConfirmation:
                return styles.warningInputContainer;
            case DestinationState.Valid:
                if (!destinationState.confirmationUsernameType) {
                    return styles.validInputContainer;
                }
                return styles.warningInputContainer;
            case DestinationState.PhoneInvalid:
                return styles.errorInputContainer;
            case DestinationState.PhoneNotAllowed:
                return styles.errorInputContainer;
            default:
                return {};
        }
    }, [
        destinationState.destinationState,
        destinationState.confirmationUsernameType,
        styles,
    ]);
    return (<Screen keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <ConfirmDestinationModal destinationState={destinationState} dispatchDestinationStateAction={dispatchDestinationStateAction}/>
      <View style={styles.sendBitcoinDestinationContainer}>
        <View style={[
            styles.fieldBackground,
            activeInputRef.current === InputType.Search && inputContainerStyle,
            activeInputRef.current === InputType.Phone && styles.disabledInput,
        ]} onStartShouldSetResponder={function () { return activeInputRef.current !== InputType.Search; }} onResponderRelease={function () { return onFocusedInput(InputType.Search); }}>
          <SearchBar {...testProps(LL.SendBitcoinScreen.placeholder())} placeholder={LL.SendBitcoinScreen.placeholder()} value={activeInputRef.current === InputType.Search
            ? destinationState.unparsedDestination
            : ""} onFocus={function () { return onFocusedInput(InputType.Search); }} onChangeText={function (text) {
            onFocusedInput(InputType.Search);
            handleChangeText(text);
            updateMatchingContacts(text);
        }} onSubmitEditing={function () {
            return willInitiateValidation() &&
                waitAndValidateDestination(destinationState.unparsedDestination);
        }} platform="default" showLoading={false} containerStyle={[styles.searchBarContainer]} inputContainerStyle={styles.searchBarInputContainerStyle} inputStyle={styles.searchBarText} searchIcon={<></>} autoCapitalize="none" autoCorrect={false} clearIcon={<></>}/>
          {destinationState.unparsedDestination &&
            activeInputRef.current === InputType.Search ? (<Icon name="close" size={24} onPress={resetInput} color={styles.icon.color} style={styles.iconContainer}/>) : (<TouchableOpacity onPress={handlePaste} disabled={activeInputRef.current === InputType.Phone}>
              <View style={styles.iconContainer}>
                <Text color={colors.primary} type="p2">
                  {LL.common.paste()}
                </Text>
              </View>
            </TouchableOpacity>)}
        </View>
        {activeInputRef.current === InputType.Search ? (<DestinationInformation destinationState={destinationState}/>) : (<View style={styles.spacerStyle}/>)}
        <PhoneInputSection rawPhoneNumber={rawPhoneNumber} setRawPhoneNumber={setRawPhoneNumber} activeInputRef={activeInputRef} destinationState={destinationState} onFocusedInput={onFocusedInput} parseValidPhone={parseValidPhone} updateMatchingContacts={updateMatchingContacts} willInitiateValidation={willInitiateValidation} waitAndValidateDestination={waitAndValidateDestination} resetInput={resetInput} setDefaultPhoneInputInfo={setDefaultPhoneInputInfo} inputContainerStyle={inputContainerStyle} matchingContacts={matchingContacts} keepCountryCode={keepCountryCode} setKeepCountryCode={setKeepCountryCode} dispatchDestinationStateAction={dispatchDestinationStateAction} defaultPhoneInputInfo={defaultPhoneInputInfo} handleChangeText={handleChangeText}/>
        <FlatList style={styles.flatList} contentContainerStyle={styles.flatListContainer} data={matchingContacts} extraData={selectedId} ListEmptyComponent={ListEmptyContent} renderItem={function (_a) {
            var _b, _c;
            var item = _a.item, index = _a.index;
            var handle = (_c = (_b = item === null || item === void 0 ? void 0 : item.handle) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
            var displayHandle = handle && !handle.includes("@") ? "".concat(handle, "@").concat(lnAddressHostname) : handle;
            return (<View style={[
                    styles.listContainer,
                    item.id === selectedId && styles.listContainerSelected,
                ]}>
                <ListItem key={item.handle} style={[]} containerStyle={[
                    matchingContacts.length > 1 &&
                        matchingContacts.length > index + 1 &&
                        styles.listItemContainer,
                    styles.listItemContainerBase,
                ]} onPress={function () { return handleContactPress(item); }}>
                  <GaloyIcon name={"user"} size={20}/>
                  <ListItem.Content>
                    <ListItem.Title style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
                      {displayHandle}
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              </View>);
        }} keyExtractor={function (item) { return item.handle; }}/>
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton title={destinationState.unparsedDestination
            ? LL.common.next()
            : LL.SendBitcoinScreen.destinationRequired()} loading={destinationState.destinationState === DestinationState.Validating} disabled={destinationState.destinationState === DestinationState.Invalid ||
            destinationState.destinationState === DestinationState.PhoneInvalid ||
            destinationState.destinationState === DestinationState.PhoneNotAllowed ||
            !destinationState.unparsedDestination ||
            (activeInputRef.current === InputType.Phone && rawPhoneNumber === "")} onPress={function () { return initiateGoToNextScreen(destinationState.unparsedDestination); }}/>
        </View>
      </View>
    </Screen>);
};
export default SendBitcoinDestinationScreen;
var PhoneInputSection = function (_a) {
    var rawPhoneNumber = _a.rawPhoneNumber, setRawPhoneNumber = _a.setRawPhoneNumber, activeInputRef = _a.activeInputRef, destinationState = _a.destinationState, onFocusedInput = _a.onFocusedInput, parseValidPhone = _a.parseValidPhone, updateMatchingContacts = _a.updateMatchingContacts, willInitiateValidation = _a.willInitiateValidation, waitAndValidateDestination = _a.waitAndValidateDestination, keepCountryCode = _a.keepCountryCode, setKeepCountryCode = _a.setKeepCountryCode, dispatchDestinationStateAction = _a.dispatchDestinationStateAction, resetInput = _a.resetInput, setDefaultPhoneInputInfo = _a.setDefaultPhoneInputInfo, inputContainerStyle = _a.inputContainerStyle, matchingContacts = _a.matchingContacts, defaultPhoneInputInfo = _a.defaultPhoneInputInfo, handleChangeText = _a.handleChangeText;
    var styles = usestyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var handlePastePhone = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var clipboard, parsed, parseNumber, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (destinationState.destinationState === DestinationState.Validating)
                        return [2 /*return*/];
                    onFocusedInput(InputType.Phone);
                    setKeepCountryCode(false);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Clipboard.getString()];
                case 2:
                    clipboard = _a.sent();
                    parsed = null;
                    parsed = parseValidPhone(clipboard);
                    parseNumber = parsed && (parsed === null || parsed === void 0 ? void 0 : parsed.isValid()) ? parsed.number : clipboard;
                    updateMatchingContacts(parseNumber);
                    dispatchDestinationStateAction({
                        type: SendBitcoinActions.SetUnparsedPastedDestination,
                        payload: {
                            unparsedDestination: parseNumber,
                        },
                    });
                    if (willInitiateValidation()) {
                        waitAndValidateDestination(parseNumber);
                        setRawPhoneNumber(parseNumber);
                    }
                    setTimeout(function () {
                        setKeepCountryCode(true);
                    }, 100);
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    if (err_2 instanceof Error) {
                        crashlytics().recordError(err_2);
                    }
                    toastShow({
                        type: "error",
                        message: function (translations) {
                            return translations.SendBitcoinDestinationScreen.clipboardError();
                        },
                        LL: LL,
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [
        destinationState.destinationState,
        onFocusedInput,
        parseValidPhone,
        updateMatchingContacts,
        willInitiateValidation,
        waitAndValidateDestination,
        LL,
        setRawPhoneNumber,
    ]);
    useEffect(function () {
        if (!defaultPhoneInputInfo)
            return;
        if (activeInputRef.current === InputType.Search)
            return;
        if (destinationState.destinationState === DestinationState.Validating ||
            destinationState.destinationState === DestinationState.Pasting)
            return;
        var rawPhoneNumber = defaultPhoneInputInfo.rawPhoneNumber;
        var rawInput = "+".concat(defaultPhoneInputInfo === null || defaultPhoneInputInfo === void 0 ? void 0 : defaultPhoneInputInfo.countryCallingCode).concat(rawPhoneNumber);
        handleChangeText(rawInput);
        updateMatchingContacts(rawPhoneNumber);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultPhoneInputInfo, handleChangeText, updateMatchingContacts]);
    useEffect(function () {
        if (!rawPhoneNumber)
            return;
        if (activeInputRef.current === InputType.Search)
            return;
        if (destinationState.destinationState === DestinationState.Validating ||
            destinationState.destinationState === DestinationState.Pasting ||
            destinationState.destinationState === DestinationState.Entering) {
            var parse = parseValidPhone(rawPhoneNumber);
            if (parse &&
                (parse === null || parse === void 0 ? void 0 : parse.isValid()) &&
                rawPhoneNumber.includes("+".concat(defaultPhoneInputInfo === null || defaultPhoneInputInfo === void 0 ? void 0 : defaultPhoneInputInfo.countryCallingCode))) {
                var phoneNumberWithoutArea = rawPhoneNumber.replace("+".concat(defaultPhoneInputInfo === null || defaultPhoneInputInfo === void 0 ? void 0 : defaultPhoneInputInfo.countryCallingCode), "");
                setRawPhoneNumber(phoneNumberWithoutArea);
            }
        }
    }, [
        rawPhoneNumber,
        defaultPhoneInputInfo,
        destinationState.destinationState,
        parseValidPhone,
        setRawPhoneNumber,
    ]);
    return (<>
      <View style={styles.textSeparator}>
        <View style={styles.line}/>
        <View style={styles.textInformationWrapper}>
          <Text style={styles.textInformation}>{LL.SendBitcoinScreen.orBySMS()}</Text>
        </View>
      </View>
      <View onStartShouldSetResponder={function () { return activeInputRef.current !== InputType.Phone; }} onResponderRelease={function () { return onFocusedInput(InputType.Phone); }}>
        <PhoneInput rightIcon={rawPhoneNumber && activeInputRef.current === InputType.Phone ? (<Icon name="close" size={24} onPress={resetInput} color={colors.primary}/>) : (<TouchableOpacity onPress={handlePastePhone} disabled={activeInputRef.current === InputType.Search}>
                <Text color={colors.primary} type="p2">
                  {LL.common.paste()}
                </Text>
              </TouchableOpacity>)} onChangeText={function (text) {
            onFocusedInput(InputType.Phone);
            setRawPhoneNumber(text);
        }} onChangeInfo={function (e) {
            setDefaultPhoneInputInfo(e);
        }} value={activeInputRef.current === InputType.Phone ? rawPhoneNumber : ""} isDisabled={activeInputRef.current === InputType.Search} onFocus={function () { return onFocusedInput(InputType.Phone); }} onSubmitEditing={function () {
            return willInitiateValidation() &&
                waitAndValidateDestination(destinationState.unparsedDestination);
        }} inputContainerStyle={activeInputRef.current === InputType.Phone && inputContainerStyle} bgColor={colors.grey6} keepCountryCode={keepCountryCode}/>
      </View>
      {activeInputRef.current === InputType.Phone ? (<DestinationInformation destinationState={destinationState}/>) : (<View style={styles.spacerStyle}/>)}
      {matchingContacts.length > 0 && (<View style={[styles.textSeparator, styles.lastInfoTextStyle]}>
          <View style={styles.line}/>
          <View style={styles.textInformationWrapper}>
            <Text style={styles.textInformation}>{LL.SendBitcoinScreen.orSaved()}</Text>
          </View>
        </View>)}
    </>);
};
var usestyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        sendBitcoinDestinationContainer: {
            padding: 20,
            flex: 1,
        },
        fieldBackground: {
            flexDirection: "row",
            overflow: "hidden",
            backgroundColor: colors.grey6,
            borderRadius: 10,
            borderColor: colors.transparent,
            borderWidth: 1,
            justifyContent: "center",
            alignItems: "center",
            height: 60,
        },
        enteringInputContainer: {},
        errorInputContainer: {
            borderColor: colors.error,
            borderWidth: 1,
        },
        validInputContainer: {
            borderColor: colors._green,
            borderWidth: 1,
        },
        warningInputContainer: {
            borderColor: colors.warning,
            borderWidth: 1,
        },
        buttonContainer: {
            marginTop: 26,
            flex: 0,
            justifyContent: "flex-end",
        },
        input: {
            flex: 1,
            paddingHorizontal: 12,
            color: colors.black,
        },
        fieldTitleText: {
            fontWeight: "bold",
            marginBottom: 5,
        },
        iconContainer: {
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
        },
        searchBarContainer: {
            flex: 1,
            backgroundColor: colors.transparent,
            borderBottomColor: colors.transparent,
            borderTopColor: colors.transparent,
            padding: 0,
        },
        searchBarInputContainerStyle: {
            backgroundColor: colors.transparent,
            marginLeft: -10,
        },
        searchBarText: {
            color: colors.black,
            textDecorationLine: "none",
        },
        icon: {
            color: colors.primary,
        },
        activityIndicatorContainer: {
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
        },
        emptyListNoContacts: {
            marginHorizontal: 12,
            marginTop: 32,
        },
        emptyListText: {
            fontSize: 18,
            marginTop: 30,
            textAlign: "center",
            color: colors.black,
        },
        emptyListTitle: {
            color: colors.warning,
            fontSize: 24,
            fontWeight: "bold",
            textAlign: "center",
        },
        itemContainer: {
            backgroundColor: colors.white,
        },
        itemText: { color: colors.black },
        textSeparator: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 35,
            marginBottom: 40,
        },
        lastInfoTextStyle: {
            marginBottom: 30,
        },
        line: {
            backgroundColor: colors.grey4,
            height: 1,
            borderRadius: 10,
            flex: 1,
            position: "relative",
        },
        textInformationWrapper: {
            backgroundColor: colors.white,
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            position: "absolute",
            zIndex: 1,
        },
        textInformation: {
            color: colors.grey1,
            textAlign: "center",
            fontSize: 16,
        },
        disabledInput: { opacity: 0.6 },
        borderFocusedInput: {
            borderColor: colors._green,
            borderWidth: 1,
            borderBottomWidth: 1,
        },
        spacerStyle: {
            marginTop: 5,
        },
        flatList: {
            flex: 1,
            marginHorizontal: -30,
        },
        flatListContainer: {},
        listContainer: {
            borderColor: colors.transparent,
            borderWidth: 1,
            marginHorizontal: 32,
            borderRadius: 8,
            overflow: "hidden",
        },
        listContainerSelected: {
            borderColor: colors.primary,
            backgroundColor: colors.grey6,
        },
        listItemContainer: {
            borderColor: colors.grey4,
            borderBottomWidth: 1,
        },
        listItemContainerBase: {
            marginHorizontal: -5,
            backgroundColor: colors.transparent,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=send-bitcoin-destination-screen.js.map