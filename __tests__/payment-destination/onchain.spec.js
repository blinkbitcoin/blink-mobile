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
var mockCreateLnurlPaymentDetail = jest.fn();
var mockCreateNoAmountOnchainPaymentDetail = jest.fn();
var mockCreateAmountOnchainPaymentDetail = jest.fn();
var mockCreateIntraledgerPaymentDetail = jest.fn();
jest.mock("@app/screens/send-bitcoin-screen/payment-details", function () {
    return {
        createAmountLightningPaymentDetails: mockCreateAmountLightningPaymentDetail,
        createNoAmountLightningPaymentDetails: mockCreateNoAmountLightningPaymentDetail,
        createLnurlPaymentDetails: mockCreateLnurlPaymentDetail,
        createNoAmountOnchainPaymentDetails: mockCreateNoAmountOnchainPaymentDetail,
        createAmountOnchainPaymentDetails: mockCreateAmountOnchainPaymentDetail,
        createIntraledgerPaymentDetails: mockCreateIntraledgerPaymentDetail,
    };
});
import { createOnchainDestination } from "@app/screens/send-bitcoin-screen/payment-destination";
import { defaultPaymentDetailParams } from "./helpers";
import { ZeroBtcMoneyAmount, toBtcMoneyAmount } from "@app/types/amounts";
describe("create onchain destination", function () {
    var baseParsedOnchainDestination = {
        paymentType: "onchain",
        valid: true,
        address: "testaddress",
        memo: "testmemo",
    };
    describe("with amount", function () {
        var parsedOnchainDestinationWithAmount = __assign(__assign({}, baseParsedOnchainDestination), { amount: 1000 });
        it("correctly creates payment detail", function () {
            var amountOnchainDestination = createOnchainDestination(parsedOnchainDestinationWithAmount);
            amountOnchainDestination.createPaymentDetail(defaultPaymentDetailParams);
            expect(mockCreateAmountOnchainPaymentDetail).toBeCalledWith({
                address: parsedOnchainDestinationWithAmount.address,
                destinationSpecifiedAmount: toBtcMoneyAmount(parsedOnchainDestinationWithAmount.amount),
                convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
                sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
                destinationSpecifiedMemo: parsedOnchainDestinationWithAmount.memo,
            });
        });
    });
    describe("without amount", function () {
        var parsedOnchainDestinationWithoutAmount = __assign({}, baseParsedOnchainDestination);
        it("correctly creates payment detail", function () {
            var noAmountOnchainDestination = createOnchainDestination(parsedOnchainDestinationWithoutAmount);
            noAmountOnchainDestination.createPaymentDetail(defaultPaymentDetailParams);
            expect(mockCreateNoAmountOnchainPaymentDetail).toBeCalledWith({
                address: parsedOnchainDestinationWithoutAmount.address,
                unitOfAccountAmount: ZeroBtcMoneyAmount,
                convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
                sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
                destinationSpecifiedMemo: parsedOnchainDestinationWithoutAmount.memo,
            });
        });
    });
});
//# sourceMappingURL=onchain.spec.js.map