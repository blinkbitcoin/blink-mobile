import React from "react";
import { View } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "@rn-vui/themed";
import { Switch } from "@app/components/atomic/switch";
import TypesafeI18n from "@app/i18n/i18n-react";
import theme from "@app/rne-theme/theme";
jest.mock("react-native-reanimated", function () { return ({
    __esModule: true,
    default: {
        View: View,
    },
    useSharedValue: function (initial) { return ({ value: initial }); },
    useAnimatedStyle: function () { return ({}); },
    withTiming: function (value) { return value; },
    interpolateColor: function () { return "transparent"; },
}); });
var renderWithTheme = function (component) {
    return render(<ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">{component}</TypesafeI18n>
    </ThemeProvider>);
};
describe("Switch", function () {
    var mockOnValueChange = jest.fn();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describe("rendering", function () {
        it("renders without crashing", function () {
            var toJSON = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange}/>).toJSON;
            expect(toJSON()).toBeTruthy();
        });
        it("renders with value true", function () {
            var toJSON = renderWithTheme(<Switch value={true} onValueChange={mockOnValueChange}/>).toJSON;
            expect(toJSON()).toBeTruthy();
        });
        it("renders with value false", function () {
            var toJSON = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange}/>).toJSON;
            expect(toJSON()).toBeTruthy();
        });
        it("renders in disabled state", function () {
            var toJSON = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} disabled/>).toJSON;
            expect(toJSON()).toBeTruthy();
        });
    });
    describe("interactions", function () {
        it("calls onValueChange with true when pressed while value is false", function () {
            var getByTestId = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(true);
            expect(mockOnValueChange).toHaveBeenCalledTimes(1);
        });
        it("calls onValueChange with false when pressed while value is true", function () {
            var getByTestId = renderWithTheme(<Switch value={true} onValueChange={mockOnValueChange} testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(false);
            expect(mockOnValueChange).toHaveBeenCalledTimes(1);
        });
        it("does not call onValueChange when disabled and pressed", function () {
            var getByTestId = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} disabled testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).not.toHaveBeenCalled();
        });
        it("toggles correctly on multiple presses", function () {
            var _a = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} testID="switch"/>), getByTestId = _a.getByTestId, rerender = _a.rerender;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(true);
            rerender(<ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={true} onValueChange={mockOnValueChange} testID="switch"/>
          </TypesafeI18n>
        </ThemeProvider>);
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(false);
            expect(mockOnValueChange).toHaveBeenCalledTimes(2);
        });
    });
    describe("disabled state", function () {
        it("does not respond to press when disabled is true", function () {
            var getByTestId = renderWithTheme(<Switch value={true} onValueChange={mockOnValueChange} disabled={true} testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).not.toHaveBeenCalled();
        });
        it("responds to press when disabled is false", function () {
            var getByTestId = renderWithTheme(<Switch value={true} onValueChange={mockOnValueChange} disabled={false} testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(false);
        });
        it("responds to press when disabled is not provided (default false)", function () {
            var getByTestId = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} testID="switch"/>).getByTestId;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenCalledWith(true);
        });
    });
    describe("callback behavior", function () {
        it("always inverts the current value on press", function () {
            var _a = renderWithTheme(<Switch value={false} onValueChange={mockOnValueChange} testID="switch"/>), getByTestId = _a.getByTestId, rerender = _a.rerender;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenLastCalledWith(true);
            rerender(<ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={true} onValueChange={mockOnValueChange} testID="switch"/>
          </TypesafeI18n>
        </ThemeProvider>);
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenLastCalledWith(false);
            rerender(<ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={false} onValueChange={mockOnValueChange} testID="switch"/>
          </TypesafeI18n>
        </ThemeProvider>);
            fireEvent(pressable, "pressIn");
            expect(mockOnValueChange).toHaveBeenLastCalledWith(true);
        });
        it("calls the correct callback when callback reference changes", function () {
            var firstCallback = jest.fn();
            var secondCallback = jest.fn();
            var _a = renderWithTheme(<Switch value={false} onValueChange={firstCallback} testID="switch"/>), getByTestId = _a.getByTestId, rerender = _a.rerender;
            var pressable = getByTestId("switch");
            fireEvent(pressable, "pressIn");
            expect(firstCallback).toHaveBeenCalledWith(true);
            expect(secondCallback).not.toHaveBeenCalled();
            rerender(<ThemeProvider theme={theme}>
          <TypesafeI18n locale="en">
            <Switch value={false} onValueChange={secondCallback} testID="switch"/>
          </TypesafeI18n>
        </ThemeProvider>);
            fireEvent(pressable, "pressIn");
            expect(secondCallback).toHaveBeenCalledWith(true);
            expect(firstCallback).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=switch.spec.js.map