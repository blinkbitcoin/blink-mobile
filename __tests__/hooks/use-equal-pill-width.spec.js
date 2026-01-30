import { act, renderHook } from "@testing-library/react-hooks";
import { useEqualPillWidth } from "@app/components/atomic/currency-pill/use-equal-pill-width";
var layoutEvent = function (width) {
    return ({
        nativeEvent: { layout: { width: width } },
    });
};
describe("useEqualPillWidth", function () {
    it("keeps width undefined until both pill widths are known", function () {
        var result = renderHook(function () { return useEqualPillWidth(); }).result;
        act(function () {
            result.current.onPillLayout("BTC")(layoutEvent(80));
        });
        expect(result.current.widthStyle).toBeUndefined();
    });
    it("uses the larger pill width once both are measured", function () {
        var result = renderHook(function () { return useEqualPillWidth(); }).result;
        act(function () {
            result.current.onPillLayout("BTC")(layoutEvent(80));
            result.current.onPillLayout("USD")(layoutEvent(120));
        });
        expect(result.current.widthStyle).toEqual({ minWidth: 120 });
    });
    it("updates when a wider pill is measured later", function () {
        var result = renderHook(function () { return useEqualPillWidth(); }).result;
        act(function () {
            result.current.onPillLayout("BTC")(layoutEvent(80));
            result.current.onPillLayout("USD")(layoutEvent(120));
        });
        act(function () {
            result.current.onPillLayout("BTC")(layoutEvent(140));
        });
        expect(result.current.widthStyle).toEqual({ minWidth: 140 });
    });
});
//# sourceMappingURL=use-equal-pill-width.spec.js.map