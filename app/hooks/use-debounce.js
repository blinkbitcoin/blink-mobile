var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useEffect, useRef, useCallback } from "react";
export var useDebouncedEffect = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var callback = args[0], delayMs = args[1], deps = args[2], options = args[3];
    var _a = options !== null && options !== void 0 ? options : {}, _b = _a.enabled, enabled = _b === void 0 ? true : _b, _c = _a.leading, leading = _c === void 0 ? false : _c, _d = _a.trailing, trailing = _d === void 0 ? true : _d;
    var timeoutRef = useRef(null);
    var leadingCalledRef = useRef(false);
    var cbRef = useRef(callback);
    cbRef.current = callback;
    useEffect(function () {
        if (!enabled) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            leadingCalledRef.current = false;
            return;
        }
        if (delayMs <= 0) {
            cbRef.current();
            return;
        }
        if (leading && !leadingCalledRef.current) {
            cbRef.current();
            leadingCalledRef.current = true;
        }
        if (trailing) {
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(function () {
                timeoutRef.current = null;
                leadingCalledRef.current = false;
                cbRef.current();
            }, delayMs);
        }
        return function () {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, __spreadArray([enabled, delayMs, leading, trailing], deps, true));
    var cancel = useCallback(function () {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        leadingCalledRef.current = false;
    }, []);
    var flush = useCallback(function () {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            leadingCalledRef.current = false;
            cbRef.current();
        }
    }, []);
    var isPending = useCallback(function () { return Boolean(timeoutRef.current); }, []);
    return { cancel: cancel, flush: flush, isPending: isPending };
};
//# sourceMappingURL=use-debounce.js.map