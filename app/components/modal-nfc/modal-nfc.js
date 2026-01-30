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
import { Alert, Pressable, View } from "react-native";
import Modal from "react-native-modal";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { LNURL_DOMAINS } from "@app/config";
import { WalletCurrency, useAccountDefaultWalletLazyQuery, useScanningQrCodeScreenQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { usePriceConversion } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination";
import { DestinationDirection, } from "@app/screens/send-bitcoin-screen/payment-destination/index.types";
import { toUsdMoneyAmount } from "@app/types/amounts";
import { logParseDestinationResult } from "@app/utils/analytics";
import { isIOS } from "@rn-vui/base";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { GaloySecondaryButton } from "../atomic/galoy-secondary-button";
export var ModalNfc = function (_a) {
    var _b, _c;
    var isActive = _a.isActive, setIsActive = _a.setIsActive, settlementAmount = _a.settlementAmount, receiveViaNFC = _a.receiveViaNFC;
    var data = useScanningQrCodeScreenQuery({ skip: !useIsAuthed() }).data;
    var wallets = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount.wallets;
    var bitcoinNetwork = (_c = data === null || data === void 0 ? void 0 : data.globals) === null || _c === void 0 ? void 0 : _c.network;
    var accountDefaultWalletQuery = useAccountDefaultWalletLazyQuery({
        fetchPolicy: "no-cache",
    })[0];
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var dismiss = React.useCallback(function () {
        setIsActive(false);
        NfcManager.cancelTechnologyRequest();
    }, [setIsActive]);
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    React.useEffect(function () {
        if (isActive && !settlementAmount) {
            Alert.alert(LL.ReceiveScreen.enterAmountFirst());
            setIsActive(false);
            return;
        }
        if (!convertMoneyAmount)
            return;
        if (isActive &&
            settlementAmount &&
            convertMoneyAmount &&
            convertMoneyAmount(toUsdMoneyAmount(settlementAmount === null || settlementAmount === void 0 ? void 0 : settlementAmount.amount), WalletCurrency.Btc)
                .amount === 0) {
            Alert.alert(LL.ReceiveScreen.cantReceiveZeroSats());
            setIsActive(false);
            return;
        }
        if (!LL ||
            !wallets ||
            !bitcoinNetwork ||
            !isActive ||
            !receiveViaNFC ||
            !settlementAmount) {
            return;
        }
        var init = function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, lnurl, isSupported, tag, error_1, destination, amount;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, NfcManager.isSupported()
                            // TODO: menu should only appear if this is a supported feature?
                        ];
                    case 1:
                        isSupported = _b.sent();
                        // TODO: menu should only appear if this is a supported feature?
                        if (!isSupported) {
                            Alert.alert(LL.SettingsScreen.nfcNotSupported());
                            dismiss();
                            return [2 /*return*/];
                        }
                        console.log("starting scanNFCTag");
                        NfcManager.start();
                        return [4 /*yield*/, NfcManager.requestTechnology(NfcTech.Ndef)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, NfcManager.getTag()];
                    case 3:
                        tag = _b.sent();
                        result = (_a = tag === null || tag === void 0 ? void 0 : tag.ndefMessage) === null || _a === void 0 ? void 0 : _a.find(function (record) {
                            var payload = record.payload;
                            var payloadString = Ndef.text.decodePayload(new Uint8Array(payload));
                            console.log("decodedPayloadString: " + payloadString);
                            if (payloadString.toLowerCase().includes("lnurl")) {
                                return record;
                            }
                            return false;
                        });
                        if (!result) {
                            Alert.alert(LL.SettingsScreen.nfcNotCompatible());
                            dismiss();
                            return [2 /*return*/];
                        }
                        lnurl = Ndef.text.decodePayload(new Uint8Array(result.payload));
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        if (!isIOS) {
                            // TODO: error that show as an Alert or onscreen message
                            // but only when it's not user initiated
                            // currently error returned is empty
                            Alert.alert(LL.SettingsScreen.nfcError());
                        }
                        console.error({ error: error_1 }, "can't fetch the Ndef payload");
                        dismiss();
                        return [2 /*return*/];
                    case 5: return [4 /*yield*/, parseDestination({
                            rawInput: lnurl,
                            myWalletIds: wallets.map(function (wallet) { return wallet.id; }),
                            bitcoinNetwork: bitcoinNetwork,
                            lnurlDomains: LNURL_DOMAINS,
                            accountDefaultWalletQuery: accountDefaultWalletQuery,
                        })];
                    case 6:
                        destination = _b.sent();
                        logParseDestinationResult(destination);
                        if (destination.valid && settlementAmount && convertMoneyAmount) {
                            if (destination.destinationDirection === DestinationDirection.Send) {
                                Alert.alert(LL.SettingsScreen.nfcOnlyReceive());
                            }
                            else {
                                amount = settlementAmount.amount;
                                if (settlementAmount.currency === WalletCurrency.Usd) {
                                    amount = convertMoneyAmount(toUsdMoneyAmount(settlementAmount.amount), WalletCurrency.Btc).amount;
                                }
                                destination.validDestination.minWithdrawable = amount * 1000; // coz msats
                                destination.validDestination.maxWithdrawable = amount * 1000; // coz msats
                                receiveViaNFC(destination);
                            }
                        }
                        dismiss();
                        return [2 /*return*/];
                }
            });
        }); };
        init();
        // Necessary because receiveViaNFC gets rerendered at useReceiveBitcoin
        // And rerendering that shouldn't cause this useEffect to retrigger
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        LL,
        wallets,
        bitcoinNetwork,
        accountDefaultWalletQuery,
        isActive,
        dismiss,
        settlementAmount,
        setIsActive,
        convertMoneyAmount,
    ]);
    return (<Modal swipeDirection={["down"]} isVisible={isActive && !isIOS} onSwipeComplete={dismiss} onBackdropPress={dismiss} backdropOpacity={0.3} backdropColor={colors.grey3} swipeThreshold={50} propagateSwipe style={styles.modal}>
      <Pressable style={styles.flex} onPress={dismiss}></Pressable>
      <SafeAreaView style={styles.modalForeground}>
        <View style={styles.iconContainer}>
          <Icon name="remove" size={72} color={colors.grey3} style={styles.icon}/>
        </View>
        <Text type="h1" bold style={styles.message}>
          {LL.SettingsScreen.nfcScanNow()}
        </Text>
        <View style={styles.scanIconContainer}>
          <Icon name="scan" size={140} color={colors.grey1}/>
        </View>
        <View style={styles.buttonContainer}>
          <GaloySecondaryButton title={LL.common.cancel()} onPress={dismiss}/>
        </View>
      </SafeAreaView>
    </Modal>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        flex: {
            maxHeight: "25%",
            flex: 1,
        },
        buttonContainer: {
            marginBottom: 32,
        },
        icon: {
            height: 40,
            top: -40,
        },
        iconContainer: {
            height: 14,
        },
        scanIconContainer: {
            height: 40,
            flex: 1,
        },
        message: {
            marginVertical: 8,
        },
        modal: {
            margin: 0,
            flex: 3,
        },
        modalForeground: {
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 10,
            flex: 1,
            backgroundColor: colors.white,
        },
        modalContent: {
            backgroundColor: "white",
        },
    });
});
//# sourceMappingURL=modal-nfc.js.map