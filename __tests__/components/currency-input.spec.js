import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render } from "@testing-library/react-native";
import { CurrencyInput } from "@app/components/currency-input/currency-input";
jest.mock("@rn-vui/themed", function () { return ({
    Text: (function () {
        var MockText = function (props) { return (<ReactNativeText {...props}/>); };
        MockText.displayName = "MockText";
        return MockText;
    })(),
    Input: (function () {
        var MockInput = React.forwardRef(function (_a, _ref) {
            var value = _a.value, placeholder = _a.placeholder, _onFocus = _a.onFocus, testID = _a.testID;
            return <ReactNativeText testID={testID}>{value || placeholder}</ReactNativeText>;
        });
        MockInput.displayName = "MockInput";
        return MockInput;
    })(),
    useTheme: function () { return ({
        theme: {
            colors: {
                grey2: "grey2",
                grey5: "grey5",
                grey1: "grey1",
            },
        },
    }); },
    makeStyles: function () { return function () { return ({
        containerBase: {},
        contentContainer: {},
        inputSection: {},
        inputOverlay: {},
        inputText: {},
        inputContainer: {},
        rightIconBox: {},
        rightIconSpacer: {},
        currencyBadge: {},
        currencyText: {},
    }); }; },
}); });
describe("CurrencyInput", function () {
    var mockOnChangeText = jest.fn();
    var inputRef = React.createRef();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("renders with value and currency", function () {
        var getByText = render(<CurrencyInput value="100" currency="USD" onChangeText={mockOnChangeText} inputRef={inputRef}/>).getByText;
        expect(getByText("100")).toBeTruthy();
        expect(getByText("USD")).toBeTruthy();
    });
    it("renders placeholder when value is empty", function () {
        var getByText = render(<CurrencyInput value="" placeholder="Enter amount" currency="BTC" onChangeText={mockOnChangeText} inputRef={inputRef}/>).getByText;
        expect(getByText("Enter amount")).toBeTruthy();
        expect(getByText("BTC")).toBeTruthy();
    });
    it("displays currency badge", function () {
        var getByText = render(<CurrencyInput value="50" currency="EUR" onChangeText={mockOnChangeText} inputRef={inputRef}/>).getByText;
        expect(getByText("EUR")).toBeTruthy();
    });
    it("renders with testId prop", function () {
        var getByTestId = render(<CurrencyInput value="100" currency="USD" onChangeText={mockOnChangeText} inputRef={inputRef} testId="currency-input-test"/>).getByTestId;
        expect(getByTestId("currency-input-test")).toBeTruthy();
    });
    it("renders without testId when not provided", function () {
        var result = render(<CurrencyInput value="100" currency="USD" onChangeText={mockOnChangeText} inputRef={inputRef}/>);
        expect(result).toBeTruthy();
    });
});
//# sourceMappingURL=currency-input.spec.js.map