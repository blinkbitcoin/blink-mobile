import { act, renderHook } from "@testing-library/react-hooks";
import { useDebouncedEffect } from "@app/hooks/use-debounce";
describe("useDebouncedEffect", function () {
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.clearAllTimers();
        jest.useRealTimers();
    });
    it("should call callback after delay on trailing edge", function () {
        var callback = jest.fn();
        renderHook(function () { return useDebouncedEffect(callback, 500, []); });
        expect(callback).not.toHaveBeenCalled();
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should call callback immediately when delay is zero", function () {
        var callback = jest.fn();
        renderHook(function () { return useDebouncedEffect(callback, 0, []); });
        expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should not call callback when enabled is false", function () {
        var callback = jest.fn();
        renderHook(function () { return useDebouncedEffect(callback, 500, [], { enabled: false }); });
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).not.toHaveBeenCalled();
    });
    it("should call callback immediately with leading option", function () {
        var callback = jest.fn();
        renderHook(function () { return useDebouncedEffect(callback, 500, [], { leading: true }); });
        expect(callback).toHaveBeenCalledTimes(1);
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).toHaveBeenCalledTimes(2);
    });
    it("should not call callback on trailing edge when trailing is false", function () {
        var callback = jest.fn();
        renderHook(function () { return useDebouncedEffect(callback, 500, [], { trailing: false }); });
        expect(callback).not.toHaveBeenCalled();
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).not.toHaveBeenCalled();
    });
    it("should reset debounce when dependencies change", function () {
        var callback = jest.fn();
        var rerender = renderHook(function (_a) {
            var dep = _a.dep;
            return useDebouncedEffect(callback, 500, [dep]);
        }, { initialProps: { dep: 1 } }).rerender;
        act(function () {
            jest.advanceTimersByTime(250);
        });
        expect(callback).not.toHaveBeenCalled();
        rerender({ dep: 2 });
        act(function () {
            jest.advanceTimersByTime(250);
        });
        expect(callback).not.toHaveBeenCalled();
        act(function () {
            jest.advanceTimersByTime(250);
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should cancel pending callback when cancel is called", function () {
        var callback = jest.fn();
        var result = renderHook(function () { return useDebouncedEffect(callback, 500, []); }).result;
        act(function () {
            jest.advanceTimersByTime(250);
        });
        expect(callback).not.toHaveBeenCalled();
        act(function () {
            result.current.cancel();
        });
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).not.toHaveBeenCalled();
    });
    it("should immediately execute pending callback when flush is called", function () {
        var callback = jest.fn();
        var result = renderHook(function () { return useDebouncedEffect(callback, 500, []); }).result;
        act(function () {
            jest.advanceTimersByTime(250);
        });
        expect(callback).not.toHaveBeenCalled();
        act(function () {
            result.current.flush();
        });
        expect(callback).toHaveBeenCalledTimes(1);
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should return true from isPending when callback is pending", function () {
        var callback = jest.fn();
        var result = renderHook(function () { return useDebouncedEffect(callback, 500, []); }).result;
        expect(result.current.isPending()).toBe(true);
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(result.current.isPending()).toBe(false);
    });
    it("should clear timeout when component unmounts", function () {
        var callback = jest.fn();
        var unmount = renderHook(function () { return useDebouncedEffect(callback, 500, []); }).unmount;
        act(function () {
            jest.advanceTimersByTime(250);
        });
        unmount();
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).not.toHaveBeenCalled();
    });
    it("should clear timeout when enabled changes to false", function () {
        var callback = jest.fn();
        var rerender = renderHook(function (_a) {
            var enabled = _a.enabled;
            return useDebouncedEffect(callback, 500, [], { enabled: enabled });
        }, { initialProps: { enabled: true } }).rerender;
        act(function () {
            jest.advanceTimersByTime(250);
        });
        rerender({ enabled: false });
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).not.toHaveBeenCalled();
    });
    it("should only call leading once until trailing executes", function () {
        var callback = jest.fn();
        var rerender = renderHook(function (_a) {
            var dep = _a.dep;
            return useDebouncedEffect(callback, 500, [dep], { leading: true });
        }, { initialProps: { dep: 1 } }).rerender;
        expect(callback).toHaveBeenCalledTimes(1);
        rerender({ dep: 2 });
        expect(callback).toHaveBeenCalledTimes(1);
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(callback).toHaveBeenCalledTimes(2);
        rerender({ dep: 3 });
        expect(callback).toHaveBeenCalledTimes(3);
    });
    it("should use latest callback reference on execution", function () {
        var counter = 0;
        var callback = jest.fn(function () {
            counter += 1;
        });
        var rerender = renderHook(function (_a) {
            var cb = _a.cb;
            return useDebouncedEffect(cb, 500, []);
        }, {
            initialProps: { cb: callback },
        }).rerender;
        counter = 10;
        var newCallback = jest.fn(function () {
            counter += 1;
        });
        rerender({ cb: newCallback });
        act(function () {
            jest.advanceTimersByTime(500);
        });
        expect(newCallback).toHaveBeenCalledTimes(1);
        expect(counter).toBe(11);
    });
});
//# sourceMappingURL=use-debounce.spec.js.map