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
import { WalletCurrency } from "@app/graphql/generated";
import { Invoice, } from "./index.types";
export var createPaymentRequestCreationData = function (params) {
    // These sets are always available
    var setType = function (type) {
        return createPaymentRequestCreationData(__assign(__assign({}, params), { type: type }));
    };
    var setDefaultWalletDescriptor = function (defaultWalletDescriptor) {
        return createPaymentRequestCreationData(__assign(__assign({}, params), { defaultWalletDescriptor: defaultWalletDescriptor }));
    };
    var setBitcoinWalletDescriptor = function (bitcoinWalletDescriptor) {
        return createPaymentRequestCreationData(__assign(__assign({}, params), { bitcoinWalletDescriptor: bitcoinWalletDescriptor }));
    };
    var setConvertMoneyAmount = function (convertMoneyAmount) {
        return createPaymentRequestCreationData(__assign(__assign({}, params), { convertMoneyAmount: convertMoneyAmount }));
    };
    var setUsername = function (username) {
        return createPaymentRequestCreationData(__assign(__assign({}, params), { username: username }));
    };
    var type = params.type, defaultWalletDescriptor = params.defaultWalletDescriptor, bitcoinWalletDescriptor = params.bitcoinWalletDescriptor, convertMoneyAmount = params.convertMoneyAmount, memo = params.memo, expirationTime = params.expirationTime;
    // Permissions for the specified type
    var permissions = {
        canSetReceivingWalletDescriptor: false,
        canSetMemo: false,
        canSetAmount: true,
        canSetExpirationTime: false,
    };
    if (type === Invoice.Lightning || type === Invoice.OnChain) {
        permissions.canSetReceivingWalletDescriptor = true;
        permissions.canSetMemo = true;
    }
    if (type === Invoice.Lightning)
        permissions.canSetExpirationTime = true;
    // Permission based sets
    var setReceivingWalletDescriptor = undefined;
    if (permissions.canSetReceivingWalletDescriptor) {
        setReceivingWalletDescriptor = function (receivingWalletDescriptor) {
            return createPaymentRequestCreationData(__assign(__assign({}, params), { receivingWalletDescriptor: receivingWalletDescriptor }));
        };
    }
    var setMemo = undefined;
    if (permissions.canSetMemo) {
        setMemo = function (memo) { return createPaymentRequestCreationData(__assign(__assign({}, params), { memo: memo })); };
    }
    var setAmount = undefined;
    if (permissions.canSetAmount) {
        setAmount = function (unitOfAccountAmount) {
            return createPaymentRequestCreationData(__assign(__assign({}, params), { unitOfAccountAmount: unitOfAccountAmount }));
        };
    }
    var setExpirationTime = undefined;
    if (permissions.canSetExpirationTime) {
        setExpirationTime = function (expirationTime) {
            return createPaymentRequestCreationData(__assign(__assign({}, params), { expirationTime: expirationTime }));
        };
    }
    // Set default receiving wallet descriptor
    var receivingWalletDescriptor = params.receivingWalletDescriptor;
    if (!receivingWalletDescriptor) {
        receivingWalletDescriptor = defaultWalletDescriptor;
    }
    // Paycode only to Bitcoin
    // FIXME: this is no longer the case
    if (type === Invoice.PayCode) {
        receivingWalletDescriptor = bitcoinWalletDescriptor;
    }
    // We currently can't set amount for on-chain USD
    if (type === Invoice.OnChain &&
        receivingWalletDescriptor.currency === WalletCurrency.Usd) {
        permissions.canSetAmount = false;
    }
    // Set settlement amount if unit of account amount is set
    var unitOfAccountAmount = params.unitOfAccountAmount;
    var settlementAmount = undefined;
    if (unitOfAccountAmount) {
        settlementAmount = convertMoneyAmount(unitOfAccountAmount, receivingWalletDescriptor.currency);
    }
    return __assign(__assign(__assign({}, params), permissions), { setType: setType, setBitcoinWalletDescriptor: setBitcoinWalletDescriptor, setDefaultWalletDescriptor: setDefaultWalletDescriptor, setConvertMoneyAmount: setConvertMoneyAmount, setUsername: setUsername, receivingWalletDescriptor: receivingWalletDescriptor, 
        // optional sets
        setReceivingWalletDescriptor: setReceivingWalletDescriptor, setMemo: setMemo, setAmount: setAmount, setExpirationTime: setExpirationTime, 
        // optional data
        unitOfAccountAmount: unitOfAccountAmount, settlementAmount: settlementAmount, memo: memo, expirationTime: expirationTime, canUsePaycode: Boolean(params.username) });
};
//# sourceMappingURL=payment-request-creation-data.js.map