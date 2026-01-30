import { ZeroBtcMoneyAmount, toBtcMoneyAmount } from "@app/types/amounts";
import { InvalidOnchainDestinationReason, } from "@blinkbitcoin/blink-client";
import { createAmountOnchainPaymentDetails, createNoAmountOnchainPaymentDetails, } from "../payment-details";
import { DestinationDirection, InvalidDestinationReason, } from "./index.types";
export var resolveOnchainDestination = function (parsedOnchainDestination) {
    if (parsedOnchainDestination.valid === true) {
        return createOnchainDestination(parsedOnchainDestination);
    }
    return {
        valid: false,
        invalidPaymentDestination: parsedOnchainDestination,
        invalidReason: mapInvalidReason(parsedOnchainDestination.invalidReason),
    };
};
export var createOnchainDestination = function (parsedOnchainDestination) {
    var address = parsedOnchainDestination.address, amount = parsedOnchainDestination.amount, memo = parsedOnchainDestination.memo;
    var createPaymentDetail;
    if (amount) {
        createPaymentDetail = function (_a) {
            var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
            return createAmountOnchainPaymentDetails({
                address: address,
                sendingWalletDescriptor: sendingWalletDescriptor,
                destinationSpecifiedAmount: toBtcMoneyAmount(amount),
                convertMoneyAmount: convertMoneyAmount,
                destinationSpecifiedMemo: memo,
            });
        };
    }
    else {
        createPaymentDetail = function (_a) {
            var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
            return createNoAmountOnchainPaymentDetails({
                address: address,
                sendingWalletDescriptor: sendingWalletDescriptor,
                convertMoneyAmount: convertMoneyAmount,
                destinationSpecifiedMemo: memo,
                unitOfAccountAmount: ZeroBtcMoneyAmount,
            });
        };
    }
    return {
        valid: true,
        createPaymentDetail: createPaymentDetail,
        destinationDirection: DestinationDirection.Send,
        validDestination: parsedOnchainDestination,
    };
};
var mapInvalidReason = function (invalidReason) {
    switch (invalidReason) {
        case InvalidOnchainDestinationReason.WrongNetwork:
            return InvalidDestinationReason.WrongNetwork;
        case InvalidOnchainDestinationReason.InvalidAmount:
            return InvalidDestinationReason.InvalidAmount;
        case InvalidOnchainDestinationReason.Unknown:
            return InvalidDestinationReason.UnknownOnchain;
    }
};
//# sourceMappingURL=onchain.js.map