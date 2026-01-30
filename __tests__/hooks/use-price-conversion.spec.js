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
var mockUseRealtimePriceQuery = jest.fn();
import { usePriceConversion } from "@app/hooks/use-price-conversion";
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount, } from "@app/types/amounts";
import { renderHook } from "@testing-library/react-hooks";
jest.mock("@app/graphql/generated", function () {
    return __assign(__assign({}, jest.requireActual("@app/graphql/generated")), { useRealtimePriceQuery: mockUseRealtimePriceQuery });
});
var mockPriceData = {
    data: {
        __typename: "Query",
        me: {
            id: "f2b1d23f-816c-51db-aea4-4b773cfdf7a7",
            __typename: "User",
            defaultAccount: {
                __typename: "ConsumerAccount",
                id: "f2b1d0bf-816c-51db-aea4-4b773cfdf7a7",
                realtimePrice: {
                    __typename: "RealtimePrice",
                    btcSatPrice: {
                        __typename: "PriceOfOneSatInMinorUnit",
                        base: 10118784000000,
                        offset: 12,
                    },
                    denominatorCurrency: "NGN",
                    id: "f2b1d0bf-816c-51db-aea4-4b773cfdf7a7",
                    timestamp: 1678314952,
                    usdCentPrice: {
                        __typename: "PriceOfOneUsdCentInMinorUnit",
                        base: 460434879,
                        offset: 6,
                    },
                },
            },
        },
    },
};
var oneThousandDollars = toUsdMoneyAmount(100000); // $1,000
var oneThousandDollarsInSats = toBtcMoneyAmount(4550299); // 4,550,299 sats
var oneThousandDollarsInNairaMinorUnits = {
    amount: 46043488,
    currency: DisplayCurrency,
    currencyCode: "NGN",
}; // 460,434.88 Naira
var amounts = {
    oneThousandDollars: oneThousandDollars,
    oneThousandDollarsInSats: oneThousandDollarsInSats,
    oneThousandDollarsInNairaMinorUnits: oneThousandDollarsInNairaMinorUnits,
};
describe("usePriceConversion", function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("should return null fields when no price is provided", function () {
        mockUseRealtimePriceQuery.mockReturnValue({ data: undefined });
        var result = renderHook(function () { return usePriceConversion(); }).result;
        expect(result.current).toEqual(expect.objectContaining({
            convertMoneyAmount: undefined,
            usdPerSat: null,
        }));
    });
    describe("convertMoneyAmount", function () {
        mockUseRealtimePriceQuery.mockReturnValue(mockPriceData);
        var result = renderHook(function () { return usePriceConversion(); }).result;
        var convertMoneyAmount = result.current.convertMoneyAmount;
        if (!convertMoneyAmount) {
            throw new Error("convertMoneyAmount is undefined");
        }
        it("should make proper conversions", function () {
            // test all conversions
            for (var _i = 0, _a = Object.keys(amounts); _i < _a.length; _i++) {
                var fromCurrency = _a[_i];
                for (var _b = 0, _c = Object.keys(amounts); _b < _c.length; _b++) {
                    var toCurrency = _c[_b];
                    var fromAmount = amounts[fromCurrency];
                    var toAmount = amounts[toCurrency];
                    var convertedAmount = convertMoneyAmount(fromAmount, toAmount.currency);
                    // expect amounts to be within .01% of each other due to rounding
                    expect((toAmount.amount - convertedAmount.amount) / convertedAmount.amount).toBeLessThan(0.0001);
                }
            }
        });
        it("should return input if the toCurrency is the same", function () {
            var amountsArray = Object.values(amounts);
            amountsArray.forEach(function (amount) {
                expect(convertMoneyAmount(amount, amount.currency)).toBe(amount);
            });
        });
    });
});
//# sourceMappingURL=use-price-conversion.spec.js.map