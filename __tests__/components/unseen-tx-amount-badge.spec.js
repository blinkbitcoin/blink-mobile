import * as React from "react";
import { Text as ReactNativeText } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { UnseenTxAmountBadge } from "@app/components/unseen-tx-amount-badge";
jest.mock("@app/components/animations", function () {
    return {
        useDropInOutAnimation: function () { return ({ opacity: 1, translateY: 0 }); },
    };
});
jest.mock("@rn-vui/themed", function () {
    return {
        Text: function (props) { return <ReactNativeText {...props}/>; },
        makeStyles: function (stylesFn) { return function (props) {
            return stylesFn({
                colors: {
                    grey2: "grey2",
                    _green: "green",
                },
            }, props);
        }; },
    };
});
describe("UnseenTxAmountBadge", function () {
    it("renders the amount text when visible", function () {
        var getByText = render(<UnseenTxAmountBadge amountText={"+USD 5"} visible={true}/>).getByText;
        expect(getByText("+USD 5")).toBeTruthy();
    });
    it("does not render text when not visible", function () {
        var queryByText = render(<UnseenTxAmountBadge amountText={"+USD 5"} visible={false}/>).queryByText;
        expect(queryByText("+USD 5")).toBeNull();
    });
    it("calls onPress when pressed", function () {
        var onPress = jest.fn();
        var getByLabelText = render(<UnseenTxAmountBadge amountText={"+USD 5"} visible={true} onPress={onPress}/>).getByLabelText;
        fireEvent.press(getByLabelText("+USD 5"));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
    it("uses outgoing styling when isOutgoing is true", function () {
        var getByTextOutgoing = render(<UnseenTxAmountBadge amountText={"-BTC 1"} visible={true} isOutgoing={true}/>).getByText;
        expect(getByTextOutgoing("-BTC 1")).toHaveStyle({ color: "grey2" });
        var getByTextIncoming = render(<UnseenTxAmountBadge amountText={"+BTC 1"} visible={true} isOutgoing={false}/>).getByText;
        expect(getByTextIncoming("+BTC 1")).toHaveStyle({ color: "green" });
    });
});
//# sourceMappingURL=unseen-tx-amount-badge.spec.js.map