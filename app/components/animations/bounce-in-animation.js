import { useEffect, useRef, useState } from "react";
import { withSequence, withTiming, withSpring, Easing, } from "react-native-reanimated";
export var bounceInAnimation = function (_a) {
    var scale = _a.scale, duration = _a.duration;
    scale.value = 0.88;
    scale.value = withSequence(withTiming(1.22, { duration: duration, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 12, stiffness: 200 }));
};
export var useBounceInAnimation = function (_a) {
    var isFocused = _a.isFocused, visible = _a.visible, scale = _a.scale, delay = _a.delay, duration = _a.duration;
    var _b = useState(false), rendered = _b[0], setRendered = _b[1];
    var timerRef = useRef(null);
    var prevFocused = useRef(false);
    var prevVisible = useRef(false);
    useEffect(function () {
        var screenJustFocused = !prevFocused.current && isFocused;
        var visibilityJustEnabled = !prevVisible.current && visible;
        var shouldStartBounce = isFocused && visible && (screenJustFocused || visibilityJustEnabled);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!isFocused || !visible) {
            setRendered(false);
            scale.value = 1;
        }
        if (shouldStartBounce) {
            setRendered(false);
            timerRef.current = setTimeout(function () {
                setRendered(true);
                bounceInAnimation({ scale: scale, duration: duration });
            }, delay);
        }
        prevFocused.current = isFocused;
        prevVisible.current = visible;
        return function () {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, [delay, duration, isFocused, scale, visible]);
    return rendered;
};
//# sourceMappingURL=bounce-in-animation.js.map