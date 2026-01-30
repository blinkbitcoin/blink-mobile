import React from "react";
import { render } from "@testing-library/react-native";
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts";
import { AmountInputScreen, ConvertInputType, } from "@app/components/transfer-amount-input/amount-input-screen";
var mockConvertMoneyAmount = jest.fn();
var mockFormatMoneyAmount = jest.fn();
var mockOnAmountChange = jest.fn();
var mockOnSetFormattedAmount = jest.fn();
jest.mock("@app/hooks/use-display-currency", function () { return ({
    useDisplayCurrency: function () { return ({
        currencyInfo: {
            BTC: {
                symbol: "",
                minorUnitToMajorUnitOffset: 0,
                showFractionDigits: false,
                currencyCode: "SAT",
            },
            USD: {
                symbol: "$",
                minorUnitToMajorUnitOffset: 2,
                showFractionDigits: true,
                currencyCode: "USD",
            },
            DisplayCurrency: {
                symbol: "$",
                minorUnitToMajorUnitOffset: 2,
                showFractionDigits: true,
                currencyCode: "USD",
            },
        },
        formatMoneyAmount: mockFormatMoneyAmount,
        zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
    }); },
}); });
jest.mock("@app/hooks/use-debounce", function () { return ({
    useDebouncedEffect: function (callback) {
        React.useEffect(function () {
            callback();
        }, [callback]);
    },
}); });
jest.mock("@app/i18n/i18n-react", function () { return ({
    useI18nContext: function () { return ({
        LL: {
            AmountInputScreen: {
                maxAmountExceeded: function (_a) {
                    var maxAmount = _a.maxAmount;
                    return "Maximum amount exceeded: ".concat(maxAmount);
                },
                minAmountNotMet: function (_a) {
                    var minAmount = _a.minAmount;
                    return "Minimum amount not met: ".concat(minAmount);
                },
            },
        },
    }); },
}); });
jest.mock("@app/components/transfer-amount-input/amount-input-screen-ui", function () { return ({
    AmountInputScreenUI: function (_a) {
        var errorMessage = _a.errorMessage, compact = _a.compact;
        var ReactNative = jest.requireActual("react-native");
        return (<ReactNative.View testID="amount-input-screen-ui">
        <ReactNative.Text testID="error-message">{errorMessage}</ReactNative.Text>
        <ReactNative.Text testID="compact-value">{String(compact)}</ReactNative.Text>
      </ReactNative.View>);
    },
}); });
describe("AmountInputScreen", function () {
    var defaultInputValues = {
        formattedAmount: "",
        fromInput: {
            id: ConvertInputType.FROM,
            currency: "BTC",
            formattedAmount: "",
            isFocused: false,
            amount: toBtcMoneyAmount(0),
        },
        toInput: {
            id: ConvertInputType.TO,
            currency: "USD",
            formattedAmount: "",
            isFocused: false,
            amount: toUsdMoneyAmount(0),
        },
        currencyInput: {
            id: ConvertInputType.CURRENCY,
            currency: "DisplayCurrency",
            formattedAmount: "",
            isFocused: false,
            amount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
        },
    };
    beforeEach(function () {
        jest.clearAllMocks();
        mockConvertMoneyAmount.mockImplementation(function (amount) { return amount; });
        mockFormatMoneyAmount.mockReturnValue("$0.00");
    });
    it("renders AmountInputScreenUI", function () {
        var getByTestId = render(<AmountInputScreen inputValues={defaultInputValues} onAmountChange={mockOnAmountChange} convertMoneyAmount={mockConvertMoneyAmount} onSetFormattedAmount={mockOnSetFormattedAmount} focusedInput={null}/>).getByTestId;
        expect(getByTestId("amount-input-screen-ui")).toBeTruthy();
    });
    it("passes compact=false by default", function () {
        var getByText = render(<AmountInputScreen inputValues={defaultInputValues} onAmountChange={mockOnAmountChange} convertMoneyAmount={mockConvertMoneyAmount} onSetFormattedAmount={mockOnSetFormattedAmount} focusedInput={null}/>).getByText;
        expect(getByText("false")).toBeTruthy();
    });
    it("passes compact=true when compact prop is true", function () {
        var getByText = render(<AmountInputScreen inputValues={defaultInputValues} onAmountChange={mockOnAmountChange} convertMoneyAmount={mockConvertMoneyAmount} onSetFormattedAmount={mockOnSetFormattedAmount} focusedInput={null} compact={true}/>).getByText;
        expect(getByText("true")).toBeTruthy();
    });
    it("renders without error message when no validation errors", function () {
        var getByTestId = render(<AmountInputScreen inputValues={defaultInputValues} onAmountChange={mockOnAmountChange} convertMoneyAmount={mockConvertMoneyAmount} onSetFormattedAmount={mockOnSetFormattedAmount} focusedInput={null}/>).getByTestId;
        var errorElement = getByTestId("error-message");
        expect(errorElement.props.children).toBe("");
    });
});
//# sourceMappingURL=amount-input-screen.spec.js.map