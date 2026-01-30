import React from "react";
import Animated, { PinwheelIn } from "react-native-reanimated";
import { ANIMATION_DELAY, ANIMATION_DURATION } from "./config";
export var SuccessIconAnimation = function (_a) {
    var children = _a.children;
    return (<Animated.View entering={PinwheelIn.duration(ANIMATION_DURATION)
            .springify()
            .delay(ANIMATION_DELAY)}>
      {children}
    </Animated.View>);
};
//# sourceMappingURL=success-icon-animation.js.map