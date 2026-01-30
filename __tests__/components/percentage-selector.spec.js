import React from "react";
import { Text as ReactNativeText } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { PercentageSelector } from "@app/components/percentage-selector/percentage-selector";
jest.mock("@rn-vui/themed", function () { return ({
    Text: function (props) { return (<ReactNativeText {...props}/>); },
    useTheme: function () { return ({
        theme: {
            colors: {
                primary: "primary",
                grey5: "grey5",
            },
        },
    }); },
    makeStyles: function () { return function () { return ({
        row: {},
        chip: {},
        chipDisabled: {},
        chipText: {},
    }); }; },
}); });
describe("PercentageSelector", function () {
    var mockOnSelect = jest.fn();
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("renders default percentage options", function () {
        var getByText = render(<PercentageSelector isLocked={false} loadingPercent={null} onSelect={mockOnSelect}/>).getByText;
        expect(getByText("25%")).toBeTruthy();
        expect(getByText("50%")).toBeTruthy();
        expect(getByText("75%")).toBeTruthy();
        expect(getByText("100%")).toBeTruthy();
    });
    it("renders custom percentage options", function () {
        var customOptions = [10, 20, 30];
        var _a = render(<PercentageSelector isLocked={false} loadingPercent={null} onSelect={mockOnSelect} options={customOptions}/>), getByText = _a.getByText, queryByText = _a.queryByText;
        expect(getByText("10%")).toBeTruthy();
        expect(getByText("20%")).toBeTruthy();
        expect(getByText("30%")).toBeTruthy();
        expect(queryByText("25%")).toBeNull();
    });
    it("calls onSelect when a percentage button is pressed", function () {
        var getByText = render(<PercentageSelector isLocked={false} loadingPercent={null} onSelect={mockOnSelect}/>).getByText;
        fireEvent.press(getByText("50%"));
        expect(mockOnSelect).toHaveBeenCalledWith(50);
        expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });
    it("does not call onSelect when isLocked is true", function () {
        var getByText = render(<PercentageSelector isLocked={true} loadingPercent={null} onSelect={mockOnSelect}/>).getByText;
        fireEvent.press(getByText("50%"));
        expect(mockOnSelect).not.toHaveBeenCalled();
    });
    it("shows ActivityIndicator when loadingPercent matches option", function () {
        var _a = render(<PercentageSelector isLocked={false} loadingPercent={75} onSelect={mockOnSelect} testIdPrefix="test"/>), getByTestId = _a.getByTestId, queryByText = _a.queryByText;
        expect(getByTestId("test-75%")).toBeTruthy();
        expect(queryByText("75%")).toBeNull();
    });
    it("shows percentage text when not loading", function () {
        var getByText = render(<PercentageSelector isLocked={false} loadingPercent={25} onSelect={mockOnSelect}/>).getByText;
        expect(getByText("50%")).toBeTruthy();
        expect(getByText("75%")).toBeTruthy();
        expect(getByText("100%")).toBeTruthy();
    });
    it("uses default testIdPrefix when not provided", function () {
        var getByTestId = render(<PercentageSelector isLocked={false} loadingPercent={null} onSelect={mockOnSelect}/>).getByTestId;
        expect(getByTestId("convert-25%")).toBeTruthy();
    });
    it("uses custom testIdPrefix when provided", function () {
        var getByTestId = render(<PercentageSelector isLocked={false} loadingPercent={null} onSelect={mockOnSelect} testIdPrefix="custom"/>).getByTestId;
        expect(getByTestId("custom-25%")).toBeTruthy();
    });
});
//# sourceMappingURL=percentage-selector.spec.js.map