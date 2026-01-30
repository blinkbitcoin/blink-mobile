import React from "react";
import { View } from "react-native";
import { ModalTooltip } from "@app/components/modal-tooltip/modal-tooltip";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { InvalidDestinationReason } from "./payment-destination/index.types";
import { DestinationState } from "./send-bitcoin-reducer";
var createToLnAddress = function (lnDomain) {
    return function (handle) {
        return "".concat(handle, "@").concat(lnDomain);
    };
};
var destinationStateToInformation = function (sendBitcoinReducerState, translate, bankDetails) {
    var _a;
    var bankName = bankDetails.bankName, lnDomain = bankDetails.lnDomain;
    var toLnAddress = createToLnAddress(lnDomain);
    if (sendBitcoinReducerState.destinationState === DestinationState.Entering) {
        return {};
    }
    if (sendBitcoinReducerState.destinationState === DestinationState.PhoneInvalid) {
        return {
            error: translate.SendBitcoinDestinationScreen.invalidPhoneNumber(),
        };
    }
    if (sendBitcoinReducerState.destinationState === DestinationState.PhoneNotAllowed) {
        return {
            error: translate.SendBitcoinDestinationScreen.phoneNotAllowed(),
        };
    }
    if (sendBitcoinReducerState.destinationState === DestinationState.Invalid) {
        switch ((_a = sendBitcoinReducerState === null || sendBitcoinReducerState === void 0 ? void 0 : sendBitcoinReducerState.invalidDestination) === null || _a === void 0 ? void 0 : _a.invalidReason) {
            case InvalidDestinationReason.InvoiceExpired:
                return {
                    error: translate.SendBitcoinDestinationScreen.expiredInvoice(),
                };
            case InvalidDestinationReason.WrongNetwork:
                return {
                    error: translate.SendBitcoinDestinationScreen.wrongNetwork(),
                };
            case InvalidDestinationReason.InvalidAmount:
                return {
                    error: translate.SendBitcoinDestinationScreen.invalidAmount(),
                };
            case InvalidDestinationReason.UsernameDoesNotExist:
                return {
                    error: translate.SendBitcoinDestinationScreen.usernameDoesNotExist({
                        lnAddress: toLnAddress((sendBitcoinReducerState === null || sendBitcoinReducerState === void 0 ? void 0 : sendBitcoinReducerState.invalidDestination.invalidPaymentDestination).handle),
                        bankName: bankName,
                    }),
                    adviceTooltip: {
                        text: translate.SendBitcoinDestinationScreen.usernameDoesNotExistAdvice(),
                    },
                };
            case InvalidDestinationReason.SelfPayment:
                return {
                    error: translate.SendBitcoinDestinationScreen.selfPaymentError({
                        lnAddress: toLnAddress(sendBitcoinReducerState.invalidDestination
                            .invalidPaymentDestination.handle),
                        bankName: bankName,
                    }),
                    adviceTooltip: {
                        text: translate.SendBitcoinDestinationScreen.selfPaymentAdvice(),
                    },
                };
            case InvalidDestinationReason.LnurlError ||
                InvalidDestinationReason.LnurlUnsupported:
                return {
                    error: translate.SendBitcoinDestinationScreen.lnAddressError(),
                    adviceTooltip: {
                        text: translate.SendBitcoinDestinationScreen.lnAddressAdvice(),
                    },
                };
            case InvalidDestinationReason.UnknownLightning:
                return {
                    error: translate.SendBitcoinDestinationScreen.unknownLightning(),
                };
            case InvalidDestinationReason.UnknownOnchain:
                return {
                    error: translate.SendBitcoinDestinationScreen.unknownOnchain(),
                };
            default:
                return {
                    error: translate.SendBitcoinDestinationScreen.enterValidDestination(),
                    adviceTooltip: {
                        text: translate.SendBitcoinDestinationScreen.destinationOptions({ bankName: bankName }),
                    },
                };
        }
    }
    if (sendBitcoinReducerState.destinationState === "valid" &&
        sendBitcoinReducerState.confirmationUsernameType) {
        return {
            warning: translate.SendBitcoinDestinationScreen.newBankAddressUsername({
                lnAddress: toLnAddress(sendBitcoinReducerState.confirmationUsernameType.username),
                bankName: bankName,
            }),
        };
    }
    return {};
};
export var DestinationInformation = function (_a) {
    var destinationState = _a.destinationState;
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var _b = appConfig.galoyInstance, lnAddressHostname = _b.lnAddressHostname, name = _b.name;
    var bankDetails = { lnDomain: lnAddressHostname, bankName: name };
    var information = destinationStateToInformation(destinationState, LL, bankDetails);
    return (<View style={styles.informationContainer}>
      {information.infoTooltip && (<ModalTooltip type="info" size={20} title={information.infoTooltip.title} text={information.infoTooltip.text}/>)}
      <View style={styles.textContainer}>
        {information.information && (<Text style={styles.informationText}>{information.information}</Text>)}
        {information.error && <Text color={colors.error}>{information.error}</Text>}
        {information.warning && <Text color={colors.warning}>{information.warning}</Text>}
      </View>
    </View>);
};
var useStyles = makeStyles(function () { return ({
    informationContainer: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 5,
    },
    informationText: {
        paddingLeft: 2,
    },
    textContainer: {
        flex: 1,
    },
}); });
//# sourceMappingURL=destination-information.js.map