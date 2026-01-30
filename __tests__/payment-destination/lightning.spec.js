// sort-imports-ignore
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var mockCreateAmountLightningPaymentDetail = jest.fn();
var mockCreateNoAmountLightningPaymentDetail = jest.fn();
jest.mock("@app/screens/send-bitcoin-screen/payment-details", function () {
    return {
        createAmountLightningPaymentDetails: mockCreateAmountLightningPaymentDetail,
        createNoAmountLightningPaymentDetails: mockCreateNoAmountLightningPaymentDetail,
    };
});
import { createLightningDestination } from "@app/screens/send-bitcoin-screen/payment-destination";
import { defaultPaymentDetailParams } from "./helpers";
import { ZeroBtcMoneyAmount, toBtcMoneyAmount } from "@app/types/amounts";
describe("create lightning destination", function () {
    var baseParsedLightningDestination = {
        paymentType: "lightning",
        valid: true,
        paymentRequest: "testinvoice",
        memo: "testmemo",
    };
    describe("with amount", function () {
        var parsedLightningDestinationWithAmount = __assign(__assign({}, baseParsedLightningDestination), { amount: 1000 });
        it("correctly creates payment detail", function () {
            var amountLightningDestination = createLightningDestination(parsedLightningDestinationWithAmount);
            amountLightningDestination.createPaymentDetail(defaultPaymentDetailParams);
            expect(mockCreateAmountLightningPaymentDetail).toBeCalledWith({
                paymentRequest: parsedLightningDestinationWithAmount.paymentRequest,
                paymentRequestAmount: toBtcMoneyAmount(parsedLightningDestinationWithAmount.amount),
                convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
                destinationSpecifiedMemo: parsedLightningDestinationWithAmount.memo,
                sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
            });
        });
    });
    describe("without amount", function () {
        var parsedLightningDestinationWithoutAmount = __assign({}, baseParsedLightningDestination);
        it("correctly creates payment detail", function () {
            var noAmountLightningDestination = createLightningDestination(parsedLightningDestinationWithoutAmount);
            noAmountLightningDestination.createPaymentDetail(defaultPaymentDetailParams);
            expect(mockCreateNoAmountLightningPaymentDetail).toBeCalledWith({
                paymentRequest: parsedLightningDestinationWithoutAmount.paymentRequest,
                unitOfAccountAmount: ZeroBtcMoneyAmount,
                convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
                destinationSpecifiedMemo: parsedLightningDestinationWithoutAmount.memo,
                sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
            });
        });
    });
});
//# sourceMappingURL=lightning.spec.js.map