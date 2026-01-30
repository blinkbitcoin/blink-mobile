import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render } from "@testing-library/react-native";
import { AmountInputScreenUI } from "@app/components/transfer-amount-input/amount-input-screen-ui";
jest.mock("@rn-vui/themed", function () { return ({
    Text: function (props) { return (<ReactNativeText {...props}/>); },
    makeStyles: function () { return function () { return ({
        amountInputScreenContainer: {},
        infoContainer: {},
        bodyContainer: {},
        keyboardContainer: {},
    }); }; },
}); });
jest.mock("@app/components/atomic/galoy-error-box", function () { return ({
    GaloyErrorBox: function (_a) {
        var errorMessage = _a.errorMessage;
        var ReactNative = jest.requireActual("react-native");
        return (<ReactNative.View testID="error-box">
        <ReactNative.Text>{errorMessage}</ReactNative.Text>
      </ReactNative.View>);
    },
}); });
jest.mock("@app/components/currency-keyboard", function () { return ({
    CurrencyKeyboard: function (_a) {
        var compact = _a.compact;
        var ReactNative = jest.requireActual("react-native");
        return (<ReactNative.View testID="currency-keyboard">
        <ReactNative.Text testID="compact-value">{String(compact)}</ReactNative.Text>
      </ReactNative.View>);
    },
}); });
describe("AmountInputScreenUI", function () {
    var mockOnKeyPress = jest.fn();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("renders without error message", function () {
        var queryByTestId = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress}/>).queryByTestId;
        expect(queryByTestId("error-box")).toBeNull();
        expect(queryByTestId("currency-keyboard")).toBeTruthy();
    });
    it("renders with error message", function () {
        var errorMessage = "Invalid amount";
        var _a = render(<AmountInputScreenUI errorMessage={errorMessage} onKeyPress={mockOnKeyPress}/>), getByTestId = _a.getByTestId, getByText = _a.getByText;
        expect(getByTestId("error-box")).toBeTruthy();
        expect(getByText(errorMessage)).toBeTruthy();
    });
    it("passes compact=false to CurrencyKeyboard by default", function () {
        var getByText = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress}/>).getByText;
        expect(getByText("false")).toBeTruthy();
    });
    it("passes compact=true to CurrencyKeyboard when compact prop is true", function () {
        var getByText = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress} compact={true}/>).getByText;
        expect(getByText("true")).toBeTruthy();
    });
});
//# sourceMappingURL=amount-input-screen-ui.spec.js.map