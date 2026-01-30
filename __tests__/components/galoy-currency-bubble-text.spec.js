import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render } from "@testing-library/react-native";
import { GaloyCurrencyBubbleText } from "@app/components/atomic/galoy-currency-bubble-text/galoy-currency-bubble-text";
import { WalletCurrency } from "@app/graphql/generated";
jest.mock("@rn-vui/themed", function () { return ({
    Text: function (props) { return (<ReactNativeText {...props}/>); },
    useTheme: function () { return ({
        theme: {
            colors: {
                white: "white",
                _white: "_white",
                primary: "primary",
                _green: "_green",
                grey3: "grey3",
            },
        },
    }); },
    makeStyles: function () { return function () { return ({
        container: {},
        text: {},
    }); }; },
}); });
describe("GaloyCurrencyBubbleText", function () {
    it("renders BTC text when currency is Btc", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Btc}/>).getByText;
        expect(getByText("BTC")).toBeTruthy();
    });
    it("renders USD text when currency is Usd", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Usd}/>).getByText;
        expect(getByText("USD")).toBeTruthy();
    });
    it("renders with highlighted by default", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Btc}/>).getByText;
        expect(getByText("BTC")).toBeTruthy();
    });
    it("renders without highlighting when highlighted is false", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Btc} highlighted={false}/>).getByText;
        expect(getByText("BTC")).toBeTruthy();
    });
    it("renders with small container size by default", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Usd}/>).getByText;
        expect(getByText("USD")).toBeTruthy();
    });
    it("renders with medium container size", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Btc} containerSize="medium"/>).getByText;
        expect(getByText("BTC")).toBeTruthy();
    });
    it("renders with large container size", function () {
        var getByText = render(<GaloyCurrencyBubbleText currency={WalletCurrency.Usd} containerSize="large"/>).getByText;
        expect(getByText("USD")).toBeTruthy();
    });
});
//# sourceMappingURL=galoy-currency-bubble-text.spec.js.map