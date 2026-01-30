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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import nfcManager from "react-native-nfc-manager";
import Icon from "react-native-vector-icons/Ionicons";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import messaging from "@react-native-firebase/messaging";
import { useApolloClient } from "@apollo/client";
import { AmountInput } from "@app/components/amount-input";
import { ExpirationTimeChooser } from "@app/components/expiration-time-chooser";
import { GaloyCurrencyBubble } from "@app/components/atomic/galoy-currency-bubble";
import { ButtonGroup } from "@app/components/button-group";
import { CustomIcon } from "@app/components/custom-icon";
import { ModalNfc } from "@app/components/modal-nfc";
import { NoteInput } from "@app/components/note-input";
import { Screen } from "@app/components/screen";
import { useLevel, AccountLevel } from "@app/graphql/level-context";
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal";
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal";
import { WalletCurrency } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { addDeviceToken, requestNotificationPermission } from "@app/utils/notifications";
import { testProps } from "../../utils/testProps";
import { withMyLnUpdateSub } from "./my-ln-updates-sub";
import { Invoice, PaymentRequestState } from "./payment/index.types";
import { QRView } from "./qr-view";
import { useReceiveBitcoin } from "./use-receive-bitcoin";
var ReceiveScreen = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var client = useApolloClient();
    var reopenUpgradeModal = useRef(false);
    var isAuthed = useIsAuthed();
    var isFocused = useIsFocused();
    var currentLevel = useLevel().currentLevel;
    var isLevelZero = currentLevel === AccountLevel.Zero;
    var request = useReceiveBitcoin();
    var _k = useState(false), isTrialAccountModalVisible = _k[0], setIsTrialAccountModalVisible = _k[1];
    var _l = useState(false), displayReceiveNfc = _l[0], setDisplayReceiveNfc = _l[1];
    var closeTrialAccountModal = function () { return setIsTrialAccountModalVisible(false); };
    var openTrialAccountModal = function () { return setIsTrialAccountModalVisible(true); };
    var nfcText = LL.ReceiveScreen.nfc();
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = (request === null || request === void 0 ? void 0 : request.type) === "Lightning" &&
                            (request === null || request === void 0 ? void 0 : request.state) === "Created";
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, nfcManager.isSupported()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        if (_a) {
                            navigation.setOptions({
                                headerRight: function () { return (<TouchableOpacity style={styles.nfcIcon} onPress={function () { return setDisplayReceiveNfc(true); }}>
              <Text type="p2">{nfcText}</Text>
              <CustomIcon name="nfc" color={colors.black}/>
            </TouchableOpacity>); },
                            });
                        }
                        else {
                            navigation.setOptions({ headerRight: function () { return <></>; } });
                        }
                        return [2 /*return*/];
                }
            });
        }); })();
        // Disable exhaustive-deps because styles.nfcIcon was causing an infinite loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nfcText, colors.black, navigation, request === null || request === void 0 ? void 0 : request.state, request === null || request === void 0 ? void 0 : request.type]);
    useFocusEffect(useCallback(function () {
        if (reopenUpgradeModal.current) {
            openTrialAccountModal();
            reopenUpgradeModal.current = false;
        }
    }, []));
    // notification permission
    useEffect(function () {
        var timeout;
        if (isAuthed && isFocused && client) {
            var WAIT_TIME_TO_PROMPT_USER = 5000;
            timeout = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, requestNotificationPermission()];
                        case 1:
                            result = _a.sent();
                            if (!(result === messaging.AuthorizationStatus.PROVISIONAL ||
                                result === messaging.AuthorizationStatus.AUTHORIZED)) return [3 /*break*/, 3];
                            return [4 /*yield*/, addDeviceToken(client)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            }); }, // no op if already requested
            WAIT_TIME_TO_PROMPT_USER);
        }
        return function () { return timeout && clearTimeout(timeout); };
    }, [isAuthed, isFocused, client]);
    useEffect(function () {
        if ((request === null || request === void 0 ? void 0 : request.state) === PaymentRequestState.Paid) {
            var id_1 = setTimeout(function () { return navigation.goBack(); }, 5000);
            return function () { return clearTimeout(id_1); };
        }
    }, [request === null || request === void 0 ? void 0 : request.state, navigation]);
    if (!request)
        return <></>;
    var OnChainCharge = ((_a = request.feesInformation) === null || _a === void 0 ? void 0 : _a.deposit.minBankFee) &&
        ((_b = request.feesInformation) === null || _b === void 0 ? void 0 : _b.deposit.minBankFeeThreshold) &&
        request.type === Invoice.OnChain ? (<View style={styles.onchainCharges}>
        <Text type="p4">
          {LL.ReceiveScreen.fees({
            minBankFee: (_c = request.feesInformation) === null || _c === void 0 ? void 0 : _c.deposit.minBankFee,
            minBankFeeThreshold: (_d = request.feesInformation) === null || _d === void 0 ? void 0 : _d.deposit.minBankFeeThreshold,
        })}
        </Text>
      </View>) : undefined;
    var isReady = request.state !== PaymentRequestState.Loading;
    var handlePressWallet = function (id) {
        if (isReady) {
            request.setReceivingWallet(id);
            request.setExpirationTime(0);
        }
    };
    return (<>
      <Screen preset="scroll" keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled" style={styles.screenStyle} {...testProps("receive-screen")}>
        <ButtonGroup selectedId={request.receivingWalletDescriptor.currency} buttons={[
            {
                id: WalletCurrency.Btc,
                text: "Bitcoin",
                icon: {
                    selected: <GaloyCurrencyBubble currency="BTC" iconSize={16}/>,
                    normal: (<GaloyCurrencyBubble currency="BTC" iconSize={16} highlighted={false}/>),
                },
            },
            {
                id: WalletCurrency.Usd,
                text: "Dollar",
                icon: {
                    selected: <GaloyCurrencyBubble currency="USD" iconSize={16}/>,
                    normal: (<GaloyCurrencyBubble currency="USD" iconSize={16} highlighted={false}/>),
                },
            },
        ]} onPress={handlePressWallet} style={styles.receivingWalletPicker} disabled={!request.canSetReceivingWalletDescriptor}/>

        <QRView type={((_f = (_e = request.info) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.invoiceType) || Invoice.OnChain} getFullUri={(_h = (_g = request.info) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.getFullUriFn} loading={request.state === PaymentRequestState.Loading} completed={request.state === PaymentRequestState.Paid} err={request.state === PaymentRequestState.Error ? LL.ReceiveScreen.error() : ""} style={styles.qrView} expired={request.state === PaymentRequestState.Expired} regenerateInvoiceFn={request.regenerateInvoice} copyToClipboard={request.copyToClipboard} isPayCode={request.type === Invoice.PayCode} canUsePayCode={request.canUsePaycode} toggleIsSetLightningAddressModalVisible={request.toggleIsSetLightningAddressModalVisible}/>

        <View style={styles.invoiceActions}>
          {request.state !== PaymentRequestState.Loading &&
            (request.type !== Invoice.PayCode ||
                (request.type === Invoice.PayCode && request.canUsePaycode)) && (<>
                <View style={styles.copyInvoiceContainer}>
                  <TouchableOpacity {...testProps(LL.ReceiveScreen.copyInvoice())} onPress={request.copyToClipboard}>
                    <Text {...testProps("Copy Invoice")} color={colors.grey2}>
                      <Icon color={colors.grey2} name="copy-outline"/>
                      <Text> </Text>
                      {LL.ReceiveScreen.copyInvoice()}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View>
                  <Text color={colors.grey2}>{request.extraDetails || ""}</Text>
                </View>
                <View style={styles.shareInvoiceContainer}>
                  <TouchableOpacity {...testProps(LL.ReceiveScreen.shareInvoice())} onPress={request.share}>
                    <Text {...testProps("Share Invoice")} color={colors.grey2}>
                      <Icon color={colors.grey2} name="share-outline"/>
                      <Text> </Text>
                      {LL.ReceiveScreen.shareInvoice()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>)}
        </View>

        <TouchableOpacity style={styles.extraDetails} onPress={request.copyToClipboard}>
          {request.readablePaymentRequest ? (request.type === Invoice.OnChain ? (<View style={styles.btcHighContainer}>
                <Text ellipsizeMode="middle" numberOfLines={1}>
                  <Text style={styles.btcHigh}>
                    {request.readablePaymentRequest.slice(0, 6)}
                  </Text>
                  <Text style={styles.btcLow}>
                    {request.readablePaymentRequest.substring(6, request.readablePaymentRequest.length - 6)}
                  </Text>
                  <Text style={styles.btcHigh}>
                    {request.readablePaymentRequest.slice(-6)}
                  </Text>
                </Text>
              </View>) : (<Text {...testProps("readable-payment-request")}>
                {request.readablePaymentRequest}
              </Text>)) : (<></>)}
        </TouchableOpacity>

        <ButtonGroup selectedId={request.type} buttons={[
            {
                id: Invoice.Lightning,
                text: "Lightning",
                icon: "flash",
            },
            { id: Invoice.PayCode, text: "Paycode", icon: "at" },
            {
                id: Invoice.OnChain,
                text: "Onchain",
                icon: "logo-bitcoin",
                disabled: isLevelZero,
            },
        ]} onPress={function (id) {
            var isBlockedOnchain = id === Invoice.OnChain && isLevelZero;
            if (isBlockedOnchain) {
                openTrialAccountModal();
                return;
            }
            if (isReady) {
                request.setType(id);
            }
        }} style={styles.invoiceTypePicker}/>
        <AmountInput unitOfAccountAmount={request.unitOfAccountAmount} setAmount={request.setAmount} canSetAmount={request.canSetAmount} convertMoneyAmount={request.convertMoneyAmount} walletCurrency={request.receivingWalletDescriptor.currency} showValuesIfDisabled={false} big={false}/>
        <NoteInput onBlur={request.setMemo} onChangeText={request.setMemoChangeText} value={request.memoChangeText || ""} editable={request.canSetMemo} style={styles.note} big={false}/>
        <ExpirationTimeChooser expirationTime={(_j = request === null || request === void 0 ? void 0 : request.expirationTime) !== null && _j !== void 0 ? _j : 0} setExpirationTime={request.setExpirationTime} walletCurrency={request.receivingWalletDescriptor.currency} disabled={!request.canSetExpirationTime} style={styles.note}/>

        {OnChainCharge}

        <SetLightningAddressModal isVisible={request.isSetLightningAddressModalVisible} toggleModal={request.toggleIsSetLightningAddressModalVisible}/>

        <ModalNfc isActive={displayReceiveNfc} setIsActive={setDisplayReceiveNfc} settlementAmount={request.settlementAmount} receiveViaNFC={request.receiveViaNFC}/>

        <TrialAccountLimitsModal isVisible={isTrialAccountModalVisible} closeModal={closeTrialAccountModal} beforeSubmit={function () {
            reopenUpgradeModal.current = true;
        }}/>
      </Screen>
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexGrow: 1,
        },
        tabRow: {
            flexDirection: "row",
            flexWrap: "nowrap",
            justifyContent: "center",
            marginTop: 12,
        },
        usdActive: {
            backgroundColor: colors._green,
            borderRadius: 7,
            justifyContent: "center",
            alignItems: "center",
            width: 150,
            height: 30,
            margin: 5,
        },
        btcActive: {
            backgroundColor: colors.primary,
            borderRadius: 7,
            justifyContent: "center",
            alignItems: "center",
            width: 150,
            height: 30,
            margin: 5,
        },
        inactiveTab: {
            backgroundColor: colors.grey3,
            borderRadius: 7,
            justifyContent: "center",
            alignItems: "center",
            width: 150,
            height: 30,
            margin: 5,
        },
        qrView: {
            marginBottom: 10,
        },
        receivingWalletPicker: {
            marginBottom: 10,
        },
        invoiceTypePicker: {
            marginBottom: 10,
        },
        note: {
            marginTop: 10,
        },
        extraDetails: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 15,
            minHeight: 20,
        },
        invoiceActions: {
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 10,
            minHeight: 20,
        },
        copyInvoiceContainer: {
            flex: 2,
            marginLeft: 10,
        },
        shareInvoiceContainer: {
            flex: 2,
            alignItems: "flex-end",
            marginRight: 10,
        },
        onchainCharges: { marginTop: 10, alignItems: "center" },
        btcHighContainer: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
        },
        btcHigh: {
            fontWeight: "700",
        },
        btcLow: {},
        nfcIcon: {
            marginTop: -1,
            marginRight: 14,
            padding: 8,
            display: "flex",
            flexDirection: "row",
            columnGap: 4,
            backgroundColor: colors.grey5,
            borderRadius: 4,
        },
    });
});
export default withMyLnUpdateSub(ReceiveScreen);
//# sourceMappingURL=receive-screen.js.map