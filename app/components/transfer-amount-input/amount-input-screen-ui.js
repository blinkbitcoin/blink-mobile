var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import * as React from "react";
import { View } from "react-native";
import { makeStyles } from "@rn-vui/themed";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { CurrencyKeyboard } from "@app/components/currency-keyboard";
export var AmountInputScreenUI = function (_a) {
    var errorMessage = _a.errorMessage, onKeyPress = _a.onKeyPress, _b = _a.compact, compact = _b === void 0 ? false : _b;
    var styles = useStyles(compact);
    return (<View style={styles.amountInputScreenContainer}>
      <View style={styles.bodyContainer}>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage}/>}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} compact={compact} safeMode/>
        </View>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_, compact) { return ({
    amountInputScreenContainer: { alignSelf: "stretch" },
    infoContainer: __assign({ justifyContent: "flex-start" }, (compact ? {} : { flex: 1 })),
    bodyContainer: __assign({}, (compact ? {} : { padding: 24 })),
    keyboardContainer: __assign({}, (compact ? { alignSelf: "stretch" } : { paddingHorizontal: 16, marginBottom: 30 })),
}); });
//# sourceMappingURL=amount-input-screen-ui.js.map