import * as React from "react";
import { Text as ReactNativeText } from "react-native";
import { render } from "@testing-library/react-native";
import { WalletCurrency } from "@app/graphql/generated";
import { CurrencyPill } from "@app/components/atomic/currency-pill";
jest.mock("@app/i18n/i18n-react", function () { return ({
    useI18nContext: function () { return ({
        LL: {
            common: {
                bitcoin: function () { return "Bitcoin"; },
                dollar: function () { return "Dollar"; },
                all: function () { return "All"; },
            },
        },
    }); },
}); });
jest.mock("@rn-vui/themed", function () {
    return {
        Text: function (props) { return (<ReactNativeText {...props}/>); },
        useTheme: function () { return ({
            theme: {
                colors: {
                    white: "white",
                    _white: "_white",
                    primary: "primary",
                    _green: "_green",
                    grey3: "grey3",
                    transparent: "transparent",
                },
            },
        }); },
        makeStyles: function () { return function () { return ({ container: {}, text: {} }); }; },
    };
});
describe("CurrencyPill", function () {
    it("renders BTC and USD labels by default", function () {
        var getByText = render(<>
        <CurrencyPill currency={WalletCurrency.Btc}/>
        <CurrencyPill currency={WalletCurrency.Usd}/>
      </>).getByText;
        expect(getByText("Bitcoin")).toBeTruthy();
        expect(getByText("Dollar")).toBeTruthy();
    });
    it("renders custom label for ALL", function () {
        var getByText = render(<CurrencyPill currency={"ALL"} label="Todos"/>).getByText;
        expect(getByText("Todos")).toBeTruthy();
    });
});
//# sourceMappingURL=currency-pill.spec.js.map