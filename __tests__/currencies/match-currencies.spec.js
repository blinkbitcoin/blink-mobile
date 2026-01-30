import { getMatchingCurrencies, wordMatchesCurrency, } from "../../app/screens/settings-screen/display-currency-screen";
var currency = {
    flag: "🇹🇹",
    id: "TTD",
    name: "Trinidad and Tobago Dollar",
    symbol: "TT$",
    fractionDigits: 2,
    __typename: "Currency",
};
var currencies = [
    {
        flag: "🇹🇹",
        id: "TTD",
        name: "Trinidad and Tobago Dollar",
        symbol: "TT$",
        fractionDigits: 2,
        __typename: "Currency",
    },
    {
        flag: "🇹🇷",
        id: "TRY",
        name: "Turkish Lira",
        symbol: "₤",
        fractionDigits: 2,
        __typename: "Currency",
    },
    {
        flag: "🇮🇳",
        id: "INR",
        name: "Indian Rupee",
        symbol: "₹",
        fractionDigits: 2,
        __typename: "Currency",
    },
    {
        flag: "🇺🇸",
        id: "USD",
        name: "US Dollar",
        symbol: "$",
        fractionDigits: 2,
        __typename: "Currency",
    },
];
describe("match-currencies", function () {
    it("wordMatchesCurrency", function () {
        expect(wordMatchesCurrency("TTD", currency)).toBe(true);
        expect(wordMatchesCurrency("ttd", currency)).toBe(true);
        expect(wordMatchesCurrency("dollar", currency)).toBe(true);
        expect(wordMatchesCurrency("toba", currency)).toBe(true);
        expect(wordMatchesCurrency("Trini", currency)).toBe(true);
        expect(wordMatchesCurrency("US", currency)).toBe(false);
        expect(wordMatchesCurrency("USD", currency)).toBe(false);
        expect(wordMatchesCurrency("usd", currency)).toBe(false);
    });
    it("getMatchingCurrencies", function () {
        expect(getMatchingCurrencies("EUR", currencies.slice())).toEqual([]);
        expect(getMatchingCurrencies("USD", currencies.slice())).toEqual([
            {
                flag: "🇺🇸",
                id: "USD",
                name: "US Dollar",
                symbol: "$",
                fractionDigits: 2,
                __typename: "Currency",
            },
        ]);
        expect(getMatchingCurrencies("dollar", currencies.slice())).toEqual([
            {
                flag: "🇹🇹",
                id: "TTD",
                name: "Trinidad and Tobago Dollar",
                symbol: "TT$",
                fractionDigits: 2,
                __typename: "Currency",
            },
            {
                flag: "🇺🇸",
                id: "USD",
                name: "US Dollar",
                symbol: "$",
                fractionDigits: 2,
                __typename: "Currency",
            },
        ]);
    });
});
//# sourceMappingURL=match-currencies.spec.js.map