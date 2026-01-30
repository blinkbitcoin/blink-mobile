import React, { forwardRef, useCallback, useEffect, useImperativeHandle } from "react";
import { Animated, TouchableOpacity, View, } from "react-native";
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "@app/utils/testProps";
export var CurrencyInput = forwardRef(function (_a, ref) {
    var placeholder = _a.placeholder, currency = _a.currency, value = _a.value, inputRef = _a.inputRef, onChangeText = _a.onChangeText, onFocus = _a.onFocus, testId = _a.testId, _b = _a.isFocused, isFocused = _b === void 0 ? false : _b, AnimatedViewStyle = _a.AnimatedViewStyle;
    var colors = useTheme().theme.colors;
    var styles = useStyles(isFocused);
    useImperativeHandle(ref, function () { return inputRef === null || inputRef === void 0 ? void 0 : inputRef.current; });
    var getEndSelection = useCallback(function () {
        var text = value !== null && value !== void 0 ? value : "";
        var pos = text.length;
        return { start: pos, end: pos };
    }, [value]);
    var handleFocus = useCallback(function () { var _a; return (_a = inputRef === null || inputRef === void 0 ? void 0 : inputRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }, [inputRef]);
    useEffect(function () {
        if (isFocused)
            handleFocus();
    }, [handleFocus, isFocused]);
    return (<Animated.View style={[styles.containerBase, AnimatedViewStyle]}>
        <View style={styles.contentContainer}>
          <View style={styles.inputSection}>
            <Input ref={inputRef} value={value} onFocus={onFocus} onChangeText={onChangeText} showSoftInputOnFocus={false} inputStyle={styles.inputText} placeholder={placeholder} placeholderTextColor={colors.grey3} inputContainerStyle={styles.inputContainer} renderErrorMessage={false} selection={getEndSelection()} pointerEvents="none" {...(testId ? testProps(testId) : {})}/>
            <TouchableOpacity style={styles.inputOverlay} activeOpacity={1} onPress={handleFocus}/>
          </View>

          <View style={styles.currencyBadge}>
            <Text type="p2" numberOfLines={1} ellipsizeMode="middle" style={styles.currencyText}>
              {currency}
            </Text>
          </View>
        </View>
      </Animated.View>);
});
var COMPONENT_DISPLAY_NAME = "CurrencyInput";
CurrencyInput.displayName = COMPONENT_DISPLAY_NAME;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        containerBase: {
            paddingVertical: 10,
            paddingRight: 15,
            paddingLeft: 5,
            borderRadius: 13,
            backgroundColor: colors.grey5,
            justifyContent: "center",
        },
        contentContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        inputSection: {
            flexDirection: "row",
            flex: 1,
            alignItems: "center",
            position: "relative",
        },
        inputOverlay: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
        },
        inputText: {
            fontSize: 20,
            lineHeight: 24,
            flex: 1,
            padding: 0,
            margin: 0,
            color: colors.black,
            fontWeight: "bold",
        },
        inputContainer: {
            borderBottomWidth: 0,
        },
        rightIconBox: {
            width: 30,
            height: 30,
            justifyContent: "center",
            alignItems: "center",
        },
        rightIconSpacer: {
            width: 30,
            height: 30,
        },
        currencyBadge: {
            borderColor: colors.grey1,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 10,
        },
        currencyText: {
            color: colors.grey1,
        },
    });
});
//# sourceMappingURL=currency-input.js.map