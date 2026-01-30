import { renderHook, act } from "@testing-library/react-hooks";
import { useOutgoingBadgeVisibility } from "@app/components/unseen-tx-amount-badge";
describe("useOutgoingBadgeVisibility", function () {
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    it("returns false initially", function () {
        var result = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: true,
                amountText: "$10",
            });
        }).result;
        expect(result.current).toBe(false);
    });
    it("returns false when isOutgoing is false", function () {
        var result = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: false,
                amountText: "$10",
            });
        }).result;
        act(function () {
            jest.advanceTimersByTime(100);
        });
        expect(result.current).toBe(false);
    });
    it("returns false when amountText is null", function () {
        var result = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: true,
                amountText: null,
            });
        }).result;
        act(function () {
            jest.advanceTimersByTime(100);
        });
        expect(result.current).toBe(false);
    });
    it("becomes visible after 50ms delay", function () {
        var result = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: true,
                amountText: "$10",
            });
        }).result;
        expect(result.current).toBe(false);
        act(function () {
            jest.advanceTimersByTime(50);
        });
        expect(result.current).toBe(true);
    });
    it("hides after ttlMs and calls onHide", function () {
        var onHide = jest.fn();
        var ttlMs = 3000;
        var result = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: true,
                amountText: "$10",
                ttlMs: ttlMs,
                onHide: onHide,
            });
        }).result;
        act(function () {
            jest.advanceTimersByTime(50);
        });
        expect(result.current).toBe(true);
        expect(onHide).not.toHaveBeenCalled();
        act(function () {
            jest.advanceTimersByTime(ttlMs);
        });
        expect(result.current).toBe(false);
        expect(onHide).toHaveBeenCalledTimes(1);
    });
    it("cleans up timeouts on unmount", function () {
        var onHide = jest.fn();
        var unmount = renderHook(function () {
            return useOutgoingBadgeVisibility({
                txId: "tx-1",
                isOutgoing: true,
                amountText: "$10",
                onHide: onHide,
            });
        }).unmount;
        act(function () {
            jest.advanceTimersByTime(25);
        });
        unmount();
        act(function () {
            jest.advanceTimersByTime(5000);
        });
        expect(onHide).not.toHaveBeenCalled();
    });
    it("restarts timers when txId changes", function () {
        var onHide = jest.fn();
        var ttlMs = 1000;
        var rerender = renderHook(function (_a) {
            var txId = _a.txId;
            return useOutgoingBadgeVisibility({
                txId: txId,
                isOutgoing: true,
                amountText: "$10",
                ttlMs: ttlMs,
                onHide: onHide,
            });
        }, { initialProps: { txId: "tx-1" } }).rerender;
        // Show badge for first tx
        act(function () {
            jest.advanceTimersByTime(50);
        });
        // Change txId before hide timeout - this cleans up old timers
        rerender({ txId: "tx-2" });
        // New timers start: wait for show (50ms) + hide (ttlMs)
        act(function () {
            jest.advanceTimersByTime(50 + ttlMs);
        });
        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=use-outgoing-badge-visibility.spec.js.map