import { WalletCurrency } from "@app/graphql/generated";
export var DisplayCurrency = "DisplayCurrency";
export var moneyAmountIsCurrencyType = function (moneyAmount, currency) {
    return moneyAmount.currency === currency;
};
export var ZeroUsdMoneyAmount = {
    amount: 0,
    currency: WalletCurrency.Usd,
    currencyCode: "USD",
};
export var ZeroBtcMoneyAmount = {
    amount: 0,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC",
};
export var toBtcMoneyAmount = function (amount) {
    if (amount === undefined) {
        return {
            amount: NaN,
            currency: WalletCurrency.Btc,
            currencyCode: "BTC",
        };
    }
    return {
        amount: amount,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
    };
};
export var toUsdMoneyAmount = function (amount) {
    if (amount === undefined) {
        return {
            amount: NaN,
            currency: WalletCurrency.Usd,
            currencyCode: "USD",
        };
    }
    return {
        amount: amount,
        currency: WalletCurrency.Usd,
        currencyCode: "USD",
    };
};
export var toWalletAmount = function (_a) {
    var amount = _a.amount, currency = _a.currency;
    if (amount === undefined) {
        return {
            amount: NaN,
            currency: currency,
            currencyCode: currency,
        };
    }
    return {
        amount: amount,
        currency: currency,
        currencyCode: currency,
    };
};
export var toDisplayAmount = function (_a) {
    var amount = _a.amount, currencyCode = _a.currencyCode;
    if (amount === undefined) {
        return {
            amount: NaN,
            currency: DisplayCurrency,
            currencyCode: currencyCode,
        };
    }
    return {
        amount: amount,
        currency: DisplayCurrency,
        currencyCode: currencyCode,
    };
};
export var createToDisplayAmount = function (currencyCode) {
    return function (amount) {
        return toDisplayAmount({ amount: amount, currencyCode: currencyCode });
    };
};
export var lessThanOrEqualTo = function (_a) {
    var value = _a.value, lessThanOrEqualTo = _a.lessThanOrEqualTo;
    return value.amount <= lessThanOrEqualTo.amount;
};
export var lessThan = function (_a) {
    var value = _a.value, lessThan = _a.lessThan;
    return value.amount < lessThan.amount;
};
export var greaterThan = function (_a) {
    var value = _a.value, greaterThan = _a.greaterThan;
    return value.amount > greaterThan.amount;
};
export var greaterThanOrEqualTo = function (_a) {
    var value = _a.value, greaterThanOrEqualTo = _a.greaterThanOrEqualTo;
    return value.amount >= greaterThanOrEqualTo.amount;
};
export var addMoneyAmounts = function (_a) {
    var a = _a.a, b = _a.b;
    return {
        amount: a.amount + b.amount,
        currency: a.currency,
        currencyCode: a.currencyCode,
    };
};
export var multiplyMoneyAmounts = function (_a) {
    var value = _a.value, multiplier = _a.multiplier;
    return {
        amount: value.amount * multiplier,
        currency: value.currency,
        currencyCode: value.currencyCode,
    };
};
export var subtractMoneyAmounts = function (_a) {
    var a = _a.a, b = _a.b;
    return {
        amount: a.amount - b.amount,
        currency: a.currency,
        currencyCode: a.currencyCode,
    };
};
export var isNonZeroMoneyAmount = function (moneyAmount) {
    return moneyAmount !== undefined && moneyAmount.amount !== 0;
};
//# sourceMappingURL=amounts.js.map