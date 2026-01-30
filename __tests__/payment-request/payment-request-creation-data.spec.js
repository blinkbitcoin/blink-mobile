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
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types";
import { createPaymentRequestCreationData } from "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data";
import { toUsdMoneyAmount } from "@app/types/amounts";
import { btcWalletDescriptor, defaultParams, usdWalletDescriptor } from "./helpers";
describe("create payment request creation data", function () {
    it("ln on btc wallet", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { defaultWalletDescriptor: btcWalletDescriptor }));
        expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
    });
    it("ln on usd wallet", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { defaultWalletDescriptor: usdWalletDescriptor }));
        expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
    });
    it("ln on usd wallet with amount", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { defaultWalletDescriptor: usdWalletDescriptor, unitOfAccountAmount: toUsdMoneyAmount(1) }));
        expect(prcd.settlementAmount).toStrictEqual(toUsdMoneyAmount(1));
        expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
    });
    it("cant use paycode", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.PayCode, defaultWalletDescriptor: usdWalletDescriptor, username: undefined }));
        expect(prcd.canUsePaycode).toBe(false);
    });
    it("can use paycode", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.PayCode, username: "test-username", defaultWalletDescriptor: usdWalletDescriptor }));
        expect(prcd.canUsePaycode).toBe(true);
        expect(prcd.username).toBe("test-username");
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(false);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(false);
        expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor);
    });
    it("onchain can set amount for btc", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.OnChain, defaultWalletDescriptor: btcWalletDescriptor }));
        expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
    });
    it("onchain can't set amount for usd", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.OnChain, defaultWalletDescriptor: usdWalletDescriptor }));
        expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor);
        expect(prcd.canSetAmount).toBe(false);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
    });
    it("ln on btc wallet with expiration time", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { defaultWalletDescriptor: btcWalletDescriptor, expirationTime: 60 }));
        expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
        expect(prcd.canSetExpirationTime).toBe(true);
    });
    it("ln on usd wallet with expiration time", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { defaultWalletDescriptor: usdWalletDescriptor, expirationTime: 5 }));
        expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor);
        expect(prcd.canSetAmount).toBe(true);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
        expect(prcd.canSetExpirationTime).toBe(true);
    });
    it("onchain can't set expiration time", function () {
        var prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.OnChain, defaultWalletDescriptor: usdWalletDescriptor }));
        expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor);
        expect(prcd.canSetAmount).toBe(false);
        expect(prcd.canSetMemo).toBe(true);
        expect(prcd.canSetReceivingWalletDescriptor).toBe(true);
        expect(prcd.canSetExpirationTime).toBe(false);
    });
});
//# sourceMappingURL=payment-request-creation-data.spec.js.map