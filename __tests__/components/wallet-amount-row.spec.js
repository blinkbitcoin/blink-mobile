import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render } from "@testing-library/react-native";
import { WalletAmountRow } from "@app/components/wallet-selector/wallet-amount-row";
import { WalletCurrency } from "@app/graphql/generated";
jest.mock("@rn-vui/themed", function () { return ({
    Text: function (props) { return (<ReactNativeText {...props}/>); },
    // eslint-disable-next-line react/display-name
    Input: React.forwardRef(function (_a, _ref) {
        var value = _a.value, placeholder = _a.placeholder, testID = _a.testID;
        return <ReactNativeText testID={testID}>{value || placeholder}</ReactNativeText>;
    }),
    useTheme: function () { return ({
        theme: {
            colors: {
                grey2: "grey2",
            },
        },
    }); },
    makeStyles: function () { return function () { return ({
        row: {},
        disabledOpacity: {},
        primaryNumberContainer: {},
        inputWithOverlay: {},
        primaryNumberText: {},
        primaryNumberInputContainer: {},
        inputOverlay: {},
        rightColumn: {},
        currencyBubbleText: {},
        walletSelectorBalanceContainer: {},
        convertText: {},
    }); }; },
}); });
jest.mock("@app/i18n/i18n-react", function () { return ({
    useI18nContext: function () { return ({
        LL: {
            common: {
                bitcoin: function () { return "Bitcoin"; },
                dollar: function () { return "Dollar"; },
            },
        },
    }); },
}); });
jest.mock("@app/components/atomic/currency-pill", function () { return ({
    CurrencyPill: function (_a) {
        var currency = _a.currency, label = _a.label;
        var ReactNative = jest.requireActual("react-native");
        var fallbackLabel = currency === WalletCurrency.Usd ? "Dollar" : "Bitcoin";
        return (<ReactNative.Text testID="currency-pill">{label !== null && label !== void 0 ? label : fallbackLabel}</ReactNative.Text>);
    },
}); });
describe("WalletAmountRow", function () {
    var mockInputRef = React.createRef();
    var mockOnOverlayPress = jest.fn();
    var mockOnFocus = jest.fn();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("renders with BTC currency and balances", function () {
        var getByText = render(<WalletAmountRow inputRef={mockInputRef} value="1000" placeholder="0" selection={{ start: 0, end: 0 }} isLocked={false} onOverlayPress={mockOnOverlayPress} onFocus={mockOnFocus} currency={WalletCurrency.Btc} balancePrimary="1,000 sats" balanceSecondary="$10.00"/>).getByText;
        expect(getByText("Bitcoin")).toBeTruthy();
        expect(getByText("1,000 sats")).toBeTruthy();
    });
    it("renders with USD currency and balances", function () {
        var getByText = render(<WalletAmountRow inputRef={mockInputRef} value="100" placeholder="0" selection={{ start: 0, end: 0 }} isLocked={false} onOverlayPress={mockOnOverlayPress} onFocus={mockOnFocus} currency={WalletCurrency.Usd} balancePrimary="$100.00" balanceSecondary="10,000 sats"/>).getByText;
        expect(getByText("Dollar")).toBeTruthy();
        expect(getByText("$100.00")).toBeTruthy();
    });
    it("renders balanceSecondary with approximate prefix", function () {
        var getByText = render(<WalletAmountRow inputRef={mockInputRef} value="50" placeholder="0" selection={{ start: 0, end: 0 }} isLocked={false} onOverlayPress={mockOnOverlayPress} onFocus={mockOnFocus} currency={WalletCurrency.Usd} balancePrimary="$50.00" balanceSecondary="5,000 sats"/>).getByText;
        expect(getByText("~ 5,000 sats")).toBeTruthy();
    });
    it("does not render balanceSecondary when null", function () {
        var queryByText = render(<WalletAmountRow inputRef={mockInputRef} value="100" placeholder="0" selection={{ start: 0, end: 0 }} isLocked={false} onOverlayPress={mockOnOverlayPress} onFocus={mockOnFocus} currency={WalletCurrency.Btc} balancePrimary="1,000 sats" balanceSecondary={null}/>).queryByText;
        expect(queryByText(/~/)).toBeNull();
    });
    it("renders placeholder when value is empty", function () {
        var getByText = render(<WalletAmountRow inputRef={mockInputRef} value="" placeholder="Enter amount" selection={{ start: 0, end: 0 }} isLocked={false} onOverlayPress={mockOnOverlayPress} onFocus={mockOnFocus} currency={WalletCurrency.Btc} balancePrimary="1,000 sats"/>).getByText;
        expect(getByText("Enter amount")).toBeTruthy();
    });
});
//# sourceMappingURL=wallet-amount-row.spec.js.map