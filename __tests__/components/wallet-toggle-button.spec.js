import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { WalletToggleButton } from "@app/components/wallet-selector/wallet-toggle-button";
jest.mock("@rn-vui/themed", function () { return ({
    Text: function (props) { return (<ReactNativeText {...props}/>); },
    useTheme: function () { return ({
        theme: {
            colors: {
                primary: "primary",
                grey4: "grey4",
                grey6: "grey6",
            },
        },
    }); },
    makeStyles: function () { return function () { return ({
        button: {},
        buttonDisabled: {},
    }); }; },
}); });
jest.mock("react-native-vector-icons/Ionicons", function () { return "Icon"; });
describe("WalletToggleButton", function () {
    var mockOnPress = jest.fn();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("renders icon when not loading", function () {
        var getByTestId = render(<WalletToggleButton loading={false} disabled={false} onPress={mockOnPress} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        expect(button).toBeTruthy();
    });
    it("renders activity indicator when loading", function () {
        var getByTestId = render(<WalletToggleButton loading={true} disabled={false} onPress={mockOnPress} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        expect(button).toBeTruthy();
    });
    it("calls onPress when pressed and not disabled", function () {
        var getByTestId = render(<WalletToggleButton loading={false} disabled={false} onPress={mockOnPress} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        fireEvent.press(button);
        expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
    it("does not call onPress when disabled", function () {
        var getByTestId = render(<WalletToggleButton loading={false} disabled={true} onPress={mockOnPress} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        fireEvent.press(button);
        expect(mockOnPress).not.toHaveBeenCalled();
    });
    it("does not call onPress when loading", function () {
        var getByTestId = render(<WalletToggleButton loading={true} disabled={false} onPress={mockOnPress} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        fireEvent.press(button);
        expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
    it("renders with custom containerStyle", function () {
        var customStyle = { marginTop: 10 };
        var getByTestId = render(<WalletToggleButton loading={false} disabled={false} onPress={mockOnPress} containerStyle={customStyle} testID="toggle-button"/>).getByTestId;
        var button = getByTestId("toggle-button");
        expect(button).toBeTruthy();
    });
});
//# sourceMappingURL=wallet-toggle-button.spec.js.map