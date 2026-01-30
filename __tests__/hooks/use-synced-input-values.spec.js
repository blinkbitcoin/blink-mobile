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
import { renderHook, act } from "@testing-library/react-hooks";
import { WalletCurrency } from "@app/graphql/generated";
import { useSyncedInputValues } from "@app/screens/conversion-flow/hooks/use-synced-input-values";
import { ConvertInputType } from "@app/components/transfer-amount-input";
import { toDisplayAmount } from "@app/types/amounts";
var mockBtcWallet = {
    id: "btc-wallet",
    balance: 100000,
    walletCurrency: WalletCurrency.Btc,
};
var mockUsdWallet = {
    id: "usd-wallet",
    balance: 50000,
    walletCurrency: WalletCurrency.Usd,
};
var createInitialCurrencyInput = function (displayCurrency) { return ({
    currencyInput: {
        id: ConvertInputType.CURRENCY,
        currency: displayCurrency,
        amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
        isFocused: false,
        formattedAmount: "",
    },
    formattedAmount: "",
}); };
describe("useSyncedInputValues", function () {
    it("returns default input values when wallets are undefined", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: undefined,
                toWallet: undefined,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd);
    });
    it("syncs input currencies with wallet currencies (BTC -> USD)", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("BTC");
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.toInput.amount.currencyCode).toBe("USD");
    });
    it("syncs input currencies with wallet currencies (USD -> BTC)", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockUsdWallet,
                toWallet: mockBtcWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("USD");
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.amount.currencyCode).toBe("BTC");
    });
    it("updates currencies when wallets change from BTC->USD to USD->BTC", function () {
        var _a = renderHook(function (_a) {
            var fromWallet = _a.fromWallet, toWallet = _a.toWallet;
            return useSyncedInputValues({
                fromWallet: fromWallet,
                toWallet: toWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }, {
            initialProps: {
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
            },
        }), result = _a.result, rerender = _a.rerender;
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd);
        rerender({
            fromWallet: mockUsdWallet,
            toWallet: mockBtcWallet,
        });
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("USD");
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc);
        expect(result.current.inputValues.toInput.amount.currencyCode).toBe("BTC");
    });
    it("preserves amount values when currencies change", function () {
        var _a = renderHook(function (_a) {
            var fromWallet = _a.fromWallet, toWallet = _a.toWallet;
            return useSyncedInputValues({
                fromWallet: fromWallet,
                toWallet: toWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }, {
            initialProps: {
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
            },
        }), result = _a.result, rerender = _a.rerender;
        act(function () {
            result.current.setInputValues(function (prev) { return (__assign(__assign({}, prev), { fromInput: __assign(__assign({}, prev.fromInput), { amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" } }), toInput: __assign(__assign({}, prev.toInput), { amount: { amount: 500, currency: WalletCurrency.Usd, currencyCode: "USD" } }) })); });
        });
        expect(result.current.inputValues.fromInput.amount.amount).toBe(1000);
        expect(result.current.inputValues.toInput.amount.amount).toBe(500);
        rerender({
            fromWallet: mockUsdWallet,
            toWallet: mockBtcWallet,
        });
        expect(result.current.inputValues.fromInput.amount.amount).toBe(1000);
        expect(result.current.inputValues.toInput.amount.amount).toBe(500);
        expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd);
        expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc);
    });
    it("initializes currencyInput with displayCurrency", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("EUR"),
            });
        }).result;
        expect(result.current.inputValues.currencyInput.currency).toBe("EUR");
        expect(result.current.inputValues.currencyInput.amount.currencyCode).toBe("EUR");
    });
    it("returns setInputValues function that updates state", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        act(function () {
            result.current.setInputValues(function (prev) { return (__assign(__assign({}, prev), { formattedAmount: "100" })); });
        });
        expect(result.current.inputValues.formattedAmount).toBe("100");
    });
    it("sets correct input IDs", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.id).toBe(ConvertInputType.FROM);
        expect(result.current.inputValues.toInput.id).toBe(ConvertInputType.TO);
        expect(result.current.inputValues.currencyInput.id).toBe(ConvertInputType.CURRENCY);
    });
    it("initializes all inputs as not focused", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.isFocused).toBe(false);
        expect(result.current.inputValues.toInput.isFocused).toBe(false);
        expect(result.current.inputValues.currencyInput.isFocused).toBe(false);
    });
    it("initializes all formattedAmount as empty strings", function () {
        var result = renderHook(function () {
            return useSyncedInputValues({
                fromWallet: mockBtcWallet,
                toWallet: mockUsdWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }).result;
        expect(result.current.inputValues.fromInput.formattedAmount).toBe("");
        expect(result.current.inputValues.toInput.formattedAmount).toBe("");
        expect(result.current.inputValues.currencyInput.formattedAmount).toBe("");
        expect(result.current.inputValues.formattedAmount).toBe("");
    });
    it("does not update when wallets are undefined", function () {
        var _a = renderHook(function (_a) {
            var fromWallet = _a.fromWallet, toWallet = _a.toWallet;
            return useSyncedInputValues({
                fromWallet: fromWallet,
                toWallet: toWallet,
                initialCurrencyInput: createInitialCurrencyInput("USD"),
            });
        }, {
            initialProps: {
                fromWallet: undefined,
                toWallet: undefined,
            },
        }), result = _a.result, rerender = _a.rerender;
        var initialFromCurrency = result.current.inputValues.fromInput.amount.currency;
        var initialToCurrency = result.current.inputValues.toInput.amount.currency;
        rerender({
            fromWallet: undefined,
            toWallet: undefined,
        });
        expect(result.current.inputValues.fromInput.amount.currency).toBe(initialFromCurrency);
        expect(result.current.inputValues.toInput.amount.currency).toBe(initialToCurrency);
    });
});
//# sourceMappingURL=use-synced-input-values.spec.js.map