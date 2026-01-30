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
import { renderHook } from "@testing-library/react-hooks";
import { WalletCurrency } from "@app/graphql/generated";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts";
var mockUseCurrencyListQuery = jest.fn();
var mockUseIsAuthed = jest.fn();
var mockUsePriceConversion = jest.fn();
var mockConvertMoneyAmount = jest.fn();
var mockToDisplayMoneyAmount = jest.fn();
jest.mock("@app/graphql/generated", function () { return (__assign(__assign({}, jest.requireActual("@app/graphql/generated")), { useCurrencyListQuery: function (options) { return mockUseCurrencyListQuery(options); } })); });
jest.mock("@app/graphql/is-authed-context", function () { return ({
    useIsAuthed: function () { return mockUseIsAuthed(); },
}); });
jest.mock("@app/hooks/use-price-conversion", function () { return ({
    usePriceConversion: function () { return mockUsePriceConversion(); },
}); });
jest.mock("@app/i18n/i18n-react", function () { return ({
    useI18nContext: function () { return ({
        LL: {
            common: {
                currencySyncIssue: function () { return "Currency sync issue"; },
            },
        },
    }); },
}); });
var setCurrencyList = function (currencyList) {
    mockUseCurrencyListQuery.mockReturnValue({
        data: {
            currencyList: currencyList,
        },
    });
};
var setPriceConversion = function (_a) {
    var displayCurrency = _a.displayCurrency, convertMoneyAmount = _a.convertMoneyAmount;
    mockUsePriceConversion.mockReturnValue(__assign({ displayCurrency: displayCurrency, toDisplayMoneyAmount: mockToDisplayMoneyAmount }, (convertMoneyAmount ? { convertMoneyAmount: convertMoneyAmount } : {})));
};
describe("useDisplayCurrency", function () {
    beforeEach(function () {
        jest.clearAllMocks();
        mockUseIsAuthed.mockReturnValue(true);
        setCurrencyList([
            { id: "USD", symbol: "$", fractionDigits: 2 },
            { id: "EUR", symbol: "€", fractionDigits: 2 },
            { id: "NGN", symbol: "₦", fractionDigits: 2 },
        ]);
        mockToDisplayMoneyAmount.mockImplementation(function (amount) { return ({
            amount: amount,
            currency: DisplayCurrency,
            currencyCode: "USD",
        }); });
        setPriceConversion({ displayCurrency: "USD" });
    });
    describe("moneyAmountToMajorUnitOrSats", function () {
        it("with 0 digits", function () {
            setCurrencyList([{ id: "JPY", symbol: "¥", fractionDigits: 0 }]);
            mockToDisplayMoneyAmount.mockImplementation(function (amount) { return ({
                amount: amount,
                currency: DisplayCurrency,
                currencyCode: "JPY",
            }); });
            setPriceConversion({ displayCurrency: "JPY" });
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var res = result.current.moneyAmountToMajorUnitOrSats({
                amount: 100,
                currency: DisplayCurrency,
                currencyCode: "JPY",
            });
            expect(res).toBe(100);
        });
        it("with 2 digits", function () {
            mockToDisplayMoneyAmount.mockImplementation(function (amount) { return ({
                amount: amount,
                currency: DisplayCurrency,
                currencyCode: "NGN",
            }); });
            setPriceConversion({ displayCurrency: "NGN" });
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var res = result.current.moneyAmountToMajorUnitOrSats({
                amount: 10,
                currency: DisplayCurrency,
                currencyCode: "NGN",
            });
            expect(res).toBe(0.1);
        });
        it("should convert BTC to sats", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var amount = result.current.moneyAmountToMajorUnitOrSats(toBtcMoneyAmount(1000));
            expect(amount).toBe(1000);
        });
        it("should convert USD cents to dollars", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var amount = result.current.moneyAmountToMajorUnitOrSats(toUsdMoneyAmount(10000));
            expect(amount).toBe(100);
        });
        it("should convert display currency minor units to major units", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var amount = result.current.moneyAmountToMajorUnitOrSats({
                amount: 10000,
                currency: DisplayCurrency,
                currencyCode: "USD",
            });
            expect(amount).toBe(100);
        });
    });
    it("unAuthed should return default value", function () {
        mockUseIsAuthed.mockReturnValue(false);
        setCurrencyList([]);
        setPriceConversion({ displayCurrency: "USD" });
        var result = renderHook(function () { return useDisplayCurrency(); }).result;
        expect(result.current).toMatchObject({
            fractionDigits: 2,
            fiatSymbol: "$",
            displayCurrency: "USD",
        });
    });
    it("authed but empty query should return default value", function () {
        setCurrencyList([]);
        setPriceConversion({ displayCurrency: "USD" });
        var result = renderHook(function () { return useDisplayCurrency(); }).result;
        expect(result.current).toMatchObject({
            fractionDigits: 2,
            fiatSymbol: "$",
            displayCurrency: "USD",
        });
    });
    it("authed should return NGN from mock", function () {
        setCurrencyList([{ id: "NGN", symbol: "₦", fractionDigits: 2 }]);
        mockToDisplayMoneyAmount.mockImplementation(function (amount) { return ({
            amount: amount,
            currency: DisplayCurrency,
            currencyCode: "NGN",
        }); });
        setPriceConversion({ displayCurrency: "NGN" });
        var result = renderHook(function () { return useDisplayCurrency(); }).result;
        expect(result.current).toMatchObject({
            fractionDigits: 2,
            fiatSymbol: "₦",
            displayCurrency: "NGN",
        });
    });
    describe("formatMoneyAmount", function () {
        it("should format BTC amount with sats suffix", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toBtcMoneyAmount(1000),
            });
            expect(formatted).toBe("1,000 SAT");
        });
        it("should format USD amount with symbol and decimals", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toUsdMoneyAmount(50000),
            });
            expect(formatted).toBe("$500.00");
        });
        it("should format display currency amount with symbol", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
            });
            expect(formatted).toBe("$100.00");
        });
        it("should return empty string for NaN amount", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toBtcMoneyAmount(NaN),
            });
            expect(formatted).toBe("");
        });
        it("should format without symbol when noSymbol is true", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toUsdMoneyAmount(10000),
                noSymbol: true,
            });
            expect(formatted).toBe("100.00");
        });
        it("should format without suffix for BTC when noSuffix is true", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toBtcMoneyAmount(500),
                noSuffix: true,
            });
            expect(formatted).toBe("500");
        });
        it("should add approximate prefix when isApproximate is true", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toUsdMoneyAmount(10000),
                isApproximate: true,
            });
            expect(formatted).toContain("~");
        });
        it("should return currency sync issue message when currency code mismatch", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
            });
            expect(formatted).toBe("Currency sync issue");
        });
        it("should format negative amounts with minus sign", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatMoneyAmount({
                moneyAmount: toUsdMoneyAmount(-10000),
            });
            expect(formatted).toBe("-$100.00");
        });
    });
    describe("formatCurrency", function () {
        it("should format currency with symbol from currency list", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatCurrency({
                amountInMajorUnits: 100,
                currency: "EUR",
            });
            expect(formatted).toBe("€100.00");
        });
        it("should use currency code as symbol for unknown currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatCurrency({
                amountInMajorUnits: 50,
                currency: "GBP",
            });
            expect(formatted).toBe("GBP50.00");
        });
        it("should format without sign when withSign is false", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatCurrency({
                amountInMajorUnits: -100,
                currency: "USD",
                withSign: false,
            });
            expect(formatted).toBe("$100.00");
        });
        it("should append currency code when provided", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatCurrency({
                amountInMajorUnits: 100,
                currency: "USD",
                currencyCode: "USD",
            });
            expect(formatted).toBe("$100.00 USD");
        });
    });
    describe("getCurrencySymbol", function () {
        it("should return symbol for currency in list", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var symbol = result.current.getCurrencySymbol({ currency: "EUR" });
            expect(symbol).toBe("€");
        });
        it("should return currency code as symbol for unknown currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var symbol = result.current.getCurrencySymbol({ currency: "JPY" });
            expect(symbol).toBe("JPY");
        });
    });
    describe("getSecondaryAmountIfCurrencyIsDifferent", function () {
        it("should return undefined when wallet currency matches display currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
                primaryAmount: toUsdMoneyAmount(10000),
                displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
                walletAmount: toUsdMoneyAmount(10000),
            });
            expect(secondaryAmount).toBeUndefined();
        });
        it("should return wallet amount when primary is display currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var walletAmount = toBtcMoneyAmount(1000);
            var secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
                primaryAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
                displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
                walletAmount: walletAmount,
            });
            expect(secondaryAmount).toBe(walletAmount);
        });
        it("should return display amount when primary is wallet currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var displayAmount = {
                amount: 10000,
                currency: DisplayCurrency,
                currencyCode: "EUR",
            };
            var secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
                primaryAmount: toBtcMoneyAmount(1000),
                displayAmount: displayAmount,
                walletAmount: toBtcMoneyAmount(1000),
            });
            expect(secondaryAmount).toBe(displayAmount);
        });
    });
    describe("formatDisplayAndWalletAmount", function () {
        it("should format with secondary amount when currencies differ", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatDisplayAndWalletAmount({
                primaryAmount: toBtcMoneyAmount(1000),
                displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
                walletAmount: toBtcMoneyAmount(1000),
            });
            expect(formatted).toContain("(");
            expect(formatted).toContain(")");
        });
        it("should format without secondary amount when currencies match", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatDisplayAndWalletAmount({
                primaryAmount: toUsdMoneyAmount(10000),
                displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
                walletAmount: toUsdMoneyAmount(10000),
            });
            expect(formatted).not.toContain("(");
        });
        it("should use display amount as primary when primary is not provided", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.formatDisplayAndWalletAmount({
                displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
                walletAmount: toUsdMoneyAmount(10000),
            });
            expect(formatted).toBe("$100.00");
        });
    });
    describe("moneyAmountToDisplayCurrencyString", function () {
        it("should return undefined when convertMoneyAmount is not available", function () {
            setPriceConversion({ displayCurrency: "USD" });
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.moneyAmountToDisplayCurrencyString({
                moneyAmount: toBtcMoneyAmount(1000),
            });
            expect(formatted).toBeUndefined();
        });
        it("should convert and format money amount to display currency", function () {
            mockConvertMoneyAmount.mockImplementation(function () { return ({
                amount: 10000,
                currency: DisplayCurrency,
                currencyCode: "USD",
            }); });
            setPriceConversion({
                displayCurrency: "USD",
                convertMoneyAmount: mockConvertMoneyAmount,
            });
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.moneyAmountToDisplayCurrencyString({
                moneyAmount: toBtcMoneyAmount(1000),
            });
            expect(formatted).toBe("$100");
        });
        it("should include approximate prefix when isApproximate is true", function () {
            mockConvertMoneyAmount.mockImplementation(function () { return ({
                amount: 10000,
                currency: DisplayCurrency,
                currencyCode: "USD",
            }); });
            setPriceConversion({
                displayCurrency: "USD",
                convertMoneyAmount: mockConvertMoneyAmount,
            });
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var formatted = result.current.moneyAmountToDisplayCurrencyString({
                moneyAmount: toBtcMoneyAmount(1000),
                isApproximate: true,
            });
            expect(formatted).toContain("~");
        });
    });
    describe("currency info", function () {
        it("should return correct info for USD", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.currencyInfo[WalletCurrency.Usd]).toEqual({
                symbol: "$",
                minorUnitToMajorUnitOffset: 2,
                showFractionDigits: true,
                currencyCode: "USD",
            });
        });
        it("should return correct info for BTC", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.currencyInfo[WalletCurrency.Btc]).toEqual({
                symbol: "",
                minorUnitToMajorUnitOffset: 0,
                showFractionDigits: false,
                currencyCode: "SAT",
            });
        });
        it("should return correct info for display currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            var info = result.current.currencyInfo[DisplayCurrency];
            expect(info.symbol).toBe("$");
            expect(info.minorUnitToMajorUnitOffset).toBe(2);
            expect(info.currencyCode).toBe("USD");
        });
    });
    describe("properties", function () {
        it("should return correct fraction digits", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.fractionDigits).toBe(2);
        });
        it("should return correct fiat symbol", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.fiatSymbol).toBe("$");
        });
        it("should return correct display currency", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.displayCurrency).toBe("USD");
        });
        it("should return zero display amount", function () {
            var result = renderHook(function () { return useDisplayCurrency(); }).result;
            expect(result.current.zeroDisplayAmount).toEqual({
                amount: 0,
                currency: DisplayCurrency,
                currencyCode: "USD",
            });
        });
    });
});
//# sourceMappingURL=use-display-currency.spec.js.map