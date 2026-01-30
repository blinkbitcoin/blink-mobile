import { WalletCurrency } from "@app/graphql/generated";
import { ZeroBtcMoneyAmount, toBtcMoneyAmount, toUsdMoneyAmount, } from "@app/types/amounts";
export var convertMoneyAmountMock = function (amount, currency) {
    return {
        amount: amount.amount,
        currency: currency,
        currencyCode: currency,
    };
};
export var zeroAmount = ZeroBtcMoneyAmount;
export var btcTestAmount = toBtcMoneyAmount(1232);
export var usdTestAmount = toUsdMoneyAmount(3212);
export var testAmount = toBtcMoneyAmount(100);
export var btcSendingWalletDescriptor = {
    currency: WalletCurrency.Btc,
    id: "testwallet",
};
export var usdSendingWalletDescriptor = {
    currency: WalletCurrency.Usd,
    id: "testwallet",
};
export var expectDestinationSpecifiedMemoCannotSetMemo = function (paymentDetails, destinationSpecifiedMemo) {
    expect(paymentDetails.canSetMemo).toBeFalsy();
    expect(paymentDetails.setMemo).toBeUndefined();
    expect(paymentDetails.memo).toEqual(destinationSpecifiedMemo);
};
export var expectCannotGetFee = function (paymentDetails) {
    expect(paymentDetails.canGetFee).toBeFalsy();
    expect(paymentDetails.getFee).toBeUndefined();
};
export var expectCannotSendPayment = function (paymentDetails) {
    expect(paymentDetails.canSendPayment).toBeFalsy();
    expect(paymentDetails.sendPaymentMutation).toBeUndefined();
};
export var createGetFeeMocks = function () {
    return {
        lnInvoiceFeeProbe: jest.fn(),
        lnUsdInvoiceFeeProbe: jest.fn(),
        lnNoAmountInvoiceFeeProbe: jest.fn(),
        lnNoAmountUsdInvoiceFeeProbe: jest.fn(),
        onChainTxFee: jest.fn(),
        onChainUsdTxFee: jest.fn(),
        onChainUsdTxFeeAsBtcDenominated: jest.fn(),
    };
};
export var createSendPaymentMocks = function () {
    return {
        lnInvoicePaymentSend: jest.fn(),
        lnNoAmountInvoicePaymentSend: jest.fn(),
        lnNoAmountUsdInvoicePaymentSend: jest.fn(),
        onChainPaymentSend: jest.fn(),
        onChainUsdPaymentSend: jest.fn(),
        onChainPaymentSendAll: jest.fn(),
        onChainUsdPaymentSendAsBtcDenominated: jest.fn(),
        intraLedgerPaymentSend: jest.fn(),
        intraLedgerUsdPaymentSend: jest.fn(),
    };
};
//# sourceMappingURL=helpers.js.map