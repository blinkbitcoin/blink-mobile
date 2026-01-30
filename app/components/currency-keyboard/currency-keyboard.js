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
import React, { useEffect, useState } from "react";
import { makeStyles, useTheme, Text } from "@rn-vui/themed";
import { Pressable, View } from "react-native";
import { testProps } from "@app/utils/testProps";
import { Key as KeyType } from "../amount-input-screen/number-pad-reducer";
var KEY_ROW_PREFIX = "row-";
var KEY_TEST_ID_PREFIX = "Key";
var useStyles = makeStyles(function (_a, compact) {
    var colors = _a.colors;
    return ({
        keyRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: compact ? 15 : 30,
        },
        lastKeyRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        keyText: {
            color: colors.grey2,
            fontSize: 24,
            fontWeight: "bold",
            textAlignVertical: "center",
        },
        pressedOpacity: {
            opacity: 0.7,
        },
    });
});
export var CurrencyKeyboard = function (_a) {
    var onPress = _a.onPress, _b = _a.compact, compact = _b === void 0 ? false : _b, _c = _a.safeMode, safeMode = _c === void 0 ? false : _c;
    var styles = useStyles(compact);
    var keyRows = [
        [KeyType[1], KeyType[2], KeyType[3]],
        [KeyType[4], KeyType[5], KeyType[6]],
        [KeyType[7], KeyType[8], KeyType[9]],
    ];
    var lastRow = [KeyType.Decimal, KeyType[0], KeyType.Backspace];
    return (<View>
      {keyRows.map(function (row, rowIndex) { return (<View key={"".concat(KEY_ROW_PREFIX).concat(rowIndex)} style={styles.keyRow}>
          {row.map(function (key) { return (<Key key={key} numberPadKey={key} handleKeyPress={onPress} compact={compact} safeMode={safeMode}/>); })}
        </View>); })}
      <View style={styles.lastKeyRow}>
        {lastRow.map(function (key) { return (<Key key={key} numberPadKey={key} handleKeyPress={onPress} compact={compact} safeMode={safeMode}/>); })}
      </View>
    </View>);
};
var Key = function (_a) {
    var handleKeyPress = _a.handleKeyPress, numberPadKey = _a.numberPadKey, compact = _a.compact, safeMode = _a.safeMode;
    var colors = useTheme().theme.colors;
    var styles = useStyles(compact);
    var pressableStyle = function (_a) {
        var pressed = _a.pressed;
        var baseStyle = {
            height: 40,
            width: 40,
            borderRadius: 40,
            maxWidth: 40,
            maxHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        };
        if (pressed) {
            return __assign(__assign({}, baseStyle), { backgroundColor: colors.grey4 });
        }
        return baseStyle;
    };
    var _b = useState(null), timerId = _b[0], setTimerId = _b[1];
    var handleBackSpacePressIn = function (numberPadKey) {
        if (safeMode)
            return;
        var id = setInterval(function () {
            if (numberPadKey === KeyType.Backspace) {
                handleKeyPress(numberPadKey);
            }
        }, 300);
        setTimerId(id);
    };
    var handleBackSpacePressOut = function () {
        if (timerId) {
            clearInterval(timerId);
            setTimerId(null);
        }
    };
    useEffect(function () {
        return function () {
            if (timerId) {
                clearInterval(timerId);
            }
        };
    }, [timerId]);
    return (<Pressable style={pressableStyle} hitSlop={20} onPressIn={function () { return handleBackSpacePressIn(numberPadKey); }} onPress={function () { return handleKeyPress(numberPadKey); }} onPressOut={handleBackSpacePressOut} {...testProps("".concat(KEY_TEST_ID_PREFIX, " ").concat(numberPadKey))}>
      {function (_a) {
            var pressed = _a.pressed;
            return (<Text style={pressed ? [styles.keyText, styles.pressedOpacity] : styles.keyText}>
            {numberPadKey}
          </Text>);
        }}
    </Pressable>);
};
//# sourceMappingURL=currency-keyboard.js.map