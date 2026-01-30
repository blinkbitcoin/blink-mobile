import { ZeroBtcMoneyAmount, toBtcMoneyAmount } from "@app/types/amounts";
import { InvalidLightningDestinationReason, } from "@blinkbitcoin/blink-client";
import { createAmountLightningPaymentDetails, createNoAmountLightningPaymentDetails, } from "../payment-details";
import { DestinationDirection, InvalidDestinationReason, } from "./index.types";
export var resolveLightningDestination = function (parsedLightningDestination) {
    if (parsedLightningDestination.valid === true) {
        return createLightningDestination(parsedLightningDestination);
    }
    return {
        valid: false,
        invalidPaymentDestination: parsedLightningDestination,
        invalidReason: mapInvalidReason(parsedLightningDestination.invalidReason),
    };
};
export var createLightningDestination = function (parsedLightningDestination) {
    var paymentRequest = parsedLightningDestination.paymentRequest, amount = parsedLightningDestination.amount, memo = parsedLightningDestination.memo;
    var createPaymentDetail;
    if (amount) {
        createPaymentDetail = function (_a) {
            var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
            return createAmountLightningPaymentDetails({
                paymentRequest: paymentRequest,
                sendingWalletDescriptor: sendingWalletDescriptor,
                paymentRequestAmount: toBtcMoneyAmount(amount),
                convertMoneyAmount: convertMoneyAmount,
                destinationSpecifiedMemo: memo,
            });
        };
    }
    else {
        createPaymentDetail = function (_a) {
            var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
            return createNoAmountLightningPaymentDetails({
                paymentRequest: paymentRequest,
                sendingWalletDescriptor: sendingWalletDescriptor,
                convertMoneyAmount: convertMoneyAmount,
                destinationSpecifiedMemo: memo,
                unitOfAccountAmount: ZeroBtcMoneyAmount,
            });
        };
    }
    return {
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: parsedLightningDestination,
        createPaymentDetail: createPaymentDetail,
    };
};
var mapInvalidReason = function (invalidLightningReason) {
    switch (invalidLightningReason) {
        case InvalidLightningDestinationReason.InvoiceExpired:
            return InvalidDestinationReason.InvoiceExpired;
        case InvalidLightningDestinationReason.WrongNetwork:
            return InvalidDestinationReason.WrongNetwork;
        case InvalidLightningDestinationReason.Unknown:
            return InvalidDestinationReason.UnknownLightning;
    }
};
//# sourceMappingURL=lightning.js.map