import { WalletCurrency } from "@app/graphql/generated";
import { greaterThan, isNonZeroMoneyAmount, moneyAmountIsCurrencyType, toUsdMoneyAmount, } from "@app/types/amounts";
import { PaymentType } from "@blinkbitcoin/blink-client";
import { AmountInvalidReason, LimitType, } from "./index.types";
export var isValidAmount = function (_a) {
    var paymentDetail = _a.paymentDetail, usdWalletAmount = _a.usdWalletAmount, btcWalletAmount = _a.btcWalletAmount, withdrawalLimits = _a.withdrawalLimits, intraledgerLimits = _a.intraledgerLimits;
    if (!paymentDetail || !isNonZeroMoneyAmount(paymentDetail.settlementAmount)) {
        return {
            validAmount: false,
            invalidReason: AmountInvalidReason.NoAmount,
        };
    }
    var settlementAmount = paymentDetail.settlementAmount;
    if (moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Btc) &&
        greaterThan({
            value: settlementAmount,
            greaterThan: btcWalletAmount,
        })) {
        return {
            validAmount: false,
            invalidReason: AmountInvalidReason.InsufficientBalance,
            balance: btcWalletAmount,
        };
    }
    if (moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Usd) &&
        greaterThan({
            value: settlementAmount,
            greaterThan: usdWalletAmount,
        })) {
        return {
            validAmount: false,
            invalidReason: AmountInvalidReason.InsufficientBalance,
            balance: usdWalletAmount,
        };
    }
    var usdAmount = paymentDetail.convertMoneyAmount(paymentDetail.unitOfAccountAmount, WalletCurrency.Usd);
    if (paymentDetail.paymentType === PaymentType.Intraledger) {
        for (var _i = 0, _b = intraledgerLimits || []; _i < _b.length; _i++) {
            var intraledgerLimit = _b[_i];
            var remainingIntraledgerLimit = intraledgerLimit.remainingLimit
                ? toUsdMoneyAmount(intraledgerLimit.remainingLimit)
                : undefined;
            if (remainingIntraledgerLimit &&
                greaterThan({
                    value: usdAmount,
                    greaterThan: remainingIntraledgerLimit,
                })) {
                return {
                    validAmount: false,
                    invalidReason: AmountInvalidReason.InsufficientLimit,
                    remainingLimit: remainingIntraledgerLimit,
                    limitType: LimitType.Intraledger,
                };
            }
        }
    }
    else {
        for (var _c = 0, _d = withdrawalLimits || []; _c < _d.length; _c++) {
            var withdrawalLimit = _d[_c];
            var remainingWithdrawalLimit = withdrawalLimit.remainingLimit
                ? toUsdMoneyAmount(withdrawalLimit.remainingLimit)
                : undefined;
            if (remainingWithdrawalLimit &&
                greaterThan({
                    value: usdAmount,
                    greaterThan: remainingWithdrawalLimit,
                })) {
                return {
                    validAmount: false,
                    invalidReason: AmountInvalidReason.InsufficientLimit,
                    remainingLimit: remainingWithdrawalLimit,
                    limitType: LimitType.Withdrawal,
                };
            }
        }
    }
    return {
        validAmount: true,
    };
};
//# sourceMappingURL=utils.js.map