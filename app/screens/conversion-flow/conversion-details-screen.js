var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Animated, Easing } from "react-native";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { gql } from "@apollo/client";
import { useConversionScreenQuery, useRealtimePriceQuery, WalletCurrency, } from "@app/graphql/generated";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useConvertMoneyDetails, } from "@app/screens/conversion-flow/use-convert-money-details";
import { DisplayCurrency, lessThan, toBtcMoneyAmount, toDisplayAmount, toUsdMoneyAmount, toWalletAmount, } from "@app/types/amounts";
import { Screen } from "@app/components/screen";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { CurrencyInput } from "@app/components/currency-input";
import { PercentageSelector } from "@app/components/percentage-selector";
import { WalletAmountRow, WalletToggleButton } from "@app/components/wallet-selector";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { useEqualPillWidth } from "@app/components/atomic/currency-pill/use-equal-pill-width";
import { AmountInputScreen, ConvertInputType, } from "@app/components/transfer-amount-input";
import { useConversionFormatting, useConversionOverlayFocus, useSyncedInputValues, } from "./hooks";
import { BTC_SUFFIX, findBtcSuffixIndex } from "./btc-format";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query conversionScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  query conversionScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
var ANIMATION_CONFIG = {
    duration: 120,
    easing: Easing.inOut(Easing.quad),
    useNativeDriver: false,
};
export var ConversionDetailsScreen = function () {
    var _a, _b, _c, _d, _e, _f, _g;
    var colors = useTheme().theme.colors;
    var navigation = useNavigation();
    useRealtimePriceQuery({ fetchPolicy: "network-only" });
    var data = useConversionScreenQuery({
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
    }).data;
    var LL = useI18nContext().LL;
    var _h = useDisplayCurrency(), formatMoneyAmount = _h.formatMoneyAmount, moneyAmountToDisplayCurrencyString = _h.moneyAmountToDisplayCurrencyString, getCurrencySymbol = _h.getCurrencySymbol, displayCurrency = _h.displayCurrency;
    var styles = useStyles(displayCurrency !== WalletCurrency.Usd);
    var btcWallet = getBtcWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets);
    var usdWallet = getUsdWallet((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.wallets);
    var _j = useConvertMoneyDetails(btcWallet && usdWallet
        ? { initialFromWallet: btcWallet, initialToWallet: usdWallet }
        : undefined), fromWallet = _j.fromWallet, toWallet = _j.toWallet, setWallets = _j.setWallets, settlementSendAmount = _j.settlementSendAmount, setMoneyAmount = _j.setMoneyAmount, convertMoneyAmount = _j.convertMoneyAmount, isValidAmount = _j.isValidAmount, moneyAmount = _j.moneyAmount, canToggleWallet = _j.canToggleWallet, toggleWallet = _j.toggleWallet;
    var _k = useState(null), focusedInputValues = _k[0], setFocusedInputValues = _k[1];
    var _l = useState(), initialAmount = _l[0], setInitialAmount = _l[1];
    var _m = useState(null), inputFormattedValues = _m[0], setInputFormattedValues = _m[1];
    var _o = useSyncedInputValues({
        fromWallet: fromWallet,
        toWallet: toWallet,
        initialCurrencyInput: {
            currencyInput: {
                id: ConvertInputType.CURRENCY,
                currency: DisplayCurrency,
                amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
                isFocused: false,
                formattedAmount: "",
            },
            formattedAmount: "",
        },
    }), inputValues = _o.inputValues, setInputValues = _o.setInputValues;
    var _p = useState(false), isTyping = _p[0], setIsTyping = _p[1];
    var _q = useState(null), typingInputId = _q[0], setTypingInputId = _q[1];
    var _r = useState(null), lockFormattingInputId = _r[0], setLockFormattingInputId = _r[1];
    var _s = useState({ from: 0, to: 0 }), rowHeights = _s[0], setRowHeights = _s[1];
    var _t = useState(false), uiLocked = _t[0], setUiLocked = _t[1];
    var _u = useState(false), overlaysReady = _u[0], setOverlaysReady = _u[1];
    var _v = useState(null), loadingPercent = _v[0], setLoadingPercent = _v[1];
    var pillLabels = useMemo(function () { return ({ BTC: LL.common.bitcoin(), USD: LL.common.dollar() }); }, [LL.common]);
    var _w = useEqualPillWidth({
        labels: pillLabels,
    }), pillWidthStyle = _w.widthStyle, onPillLayout = _w.onPillLayout;
    var fromInputRef = useRef(null);
    var toInputRef = useRef(null);
    var currencyInputRef = useRef(null);
    var toggleInitiated = useRef(false);
    var pendingFocusId = useRef(null);
    var hadInitialFocus = useRef(false);
    var inputAnimations = useRef(Object.fromEntries([ConvertInputType.FROM, ConvertInputType.TO, ConvertInputType.CURRENCY].map(function (type) { return [type, new Animated.Value(0)]; }))).current;
    useEffect(function () {
        var focusedId = focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id;
        Animated.parallel([ConvertInputType.FROM, ConvertInputType.TO, ConvertInputType.CURRENCY].map(function (type) {
            return Animated.timing(inputAnimations[type], __assign({ toValue: type === focusedId ? 1 : 0 }, ANIMATION_CONFIG));
        })).start();
    }, [focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id, inputAnimations]);
    var getAnimatedBackground = function (type) { return ({
        backgroundColor: inputAnimations[type].interpolate({
            inputRange: [0, 1],
            outputRange: [colors.grey5, colors.grey6],
        }),
    }); };
    useEffect(function () {
        var timer = setTimeout(function () {
            setOverlaysReady(true);
        }, 50);
        return function () { return clearTimeout(timer); };
    }, []);
    var _x = useConversionFormatting({
        inputValues: inputValues,
        inputFormattedValues: inputFormattedValues,
        isTyping: isTyping,
        typingInputId: typingInputId,
        lockFormattingInputId: lockFormattingInputId,
        displayCurrency: displayCurrency,
        getCurrencySymbol: getCurrencySymbol,
    }), renderValue = _x.renderValue, caretSelectionFor = _x.caretSelectionFor;
    var _y = useConversionOverlayFocus({
        uiLocked: uiLocked,
        lockFormattingInputId: lockFormattingInputId,
        setLockFormattingInputId: setLockFormattingInputId,
        setIsTyping: setIsTyping,
        inputFormattedValues: inputFormattedValues,
        inputValues: inputValues,
        renderValue: renderValue,
        fromInputRef: fromInputRef,
        toInputRef: toInputRef,
        setFocusedInputValues: setFocusedInputValues,
    }), handleInputPress = _y.handleInputPress, focusPhysically = _y.focusPhysically;
    var isCurrencyVisible = displayCurrency !== WalletCurrency.Usd;
    var maxRowHeight = Math.max(rowHeights.from, rowHeights.to);
    var rowMinHeightStyle = maxRowHeight ? { minHeight: maxRowHeight } : undefined;
    var pillContainerStyle = pillWidthStyle;
    var setRowHeight = useCallback(function (key) { return function (event) {
        var height = event.nativeEvent.layout.height;
        setRowHeights(function (prev) {
            var _a;
            return (prev[key] === height ? prev : __assign(__assign({}, prev), (_a = {}, _a[key] = height, _a)));
        });
    }; }, []);
    useEffect(function () {
        var _a, _b, _c;
        if (hadInitialFocus.current || !overlaysReady)
            return;
        var initialId = isCurrencyVisible
            ? ConvertInputType.CURRENCY
            : ConvertInputType.FROM;
        var baseTarget = initialId === ConvertInputType.CURRENCY
            ? (_a = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.currencyInput) !== null && _a !== void 0 ? _a : __assign({}, inputValues.currencyInput)
            : (_b = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.fromInput) !== null && _b !== void 0 ? _b : __assign({}, inputValues.fromInput);
        setFocusedInputValues(__assign(__assign({}, baseTarget), { id: initialId, isFocused: true }));
        if (initialId === ConvertInputType.FROM && fromInputRef.current) {
            var value = ((_c = baseTarget.formattedAmount) !== null && _c !== void 0 ? _c : "");
            var pos_1 = findBtcSuffixIndex(value);
            setTimeout(function () {
                var _a, _b;
                (_a = fromInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
                (_b = fromInputRef.current) === null || _b === void 0 ? void 0 : _b.setNativeProps({ selection: { start: pos_1, end: pos_1 } });
            }, 10);
        }
        hadInitialFocus.current = true;
    }, [overlaysReady, isCurrencyVisible, inputFormattedValues, inputValues]);
    useEffect(function () {
        if (!focusedInputValues)
            return;
        if (lockFormattingInputId && lockFormattingInputId !== focusedInputValues.id) {
            setLockFormattingInputId(null);
            setIsTyping(false);
        }
    }, [focusedInputValues, lockFormattingInputId]);
    useEffect(function () {
        if (!fromWallet && btcWallet && usdWallet) {
            setWallets({ fromWallet: btcWallet, toWallet: usdWallet });
        }
    }, [btcWallet, usdWallet, fromWallet, setWallets]);
    var handleSetMoneyAmount = useCallback(function (amount) { return setMoneyAmount(amount); }, [setMoneyAmount]);
    var onSetFormattedValues = useCallback(function (values) {
        if (!values)
            return;
        setInputFormattedValues(function (prev) {
            if (!prev)
                return values;
            var sameSnapshot = prev.formattedAmount === values.formattedAmount &&
                prev.fromInput.formattedAmount === values.fromInput.formattedAmount &&
                prev.toInput.formattedAmount === values.toInput.formattedAmount &&
                prev.currencyInput.formattedAmount === values.currencyInput.formattedAmount &&
                prev.fromInput.currency === values.fromInput.currency &&
                prev.toInput.currency === values.toInput.currency &&
                prev.currencyInput.currency === values.currencyInput.currency;
            return sameSnapshot ? prev : values;
        });
    }, []);
    useEffect(function () {
        var _a;
        if (displayCurrency === WalletCurrency.Usd && fromInputRef.current) {
            var value = (_a = renderValue(ConvertInputType.FROM)) !== null && _a !== void 0 ? _a : "";
            var pos_2 = findBtcSuffixIndex(value);
            setTimeout(function () {
                var _a;
                (_a = fromInputRef.current) === null || _a === void 0 ? void 0 : _a.setNativeProps({ selection: { start: pos_2, end: pos_2 } });
            }, 100);
        }
    }, [displayCurrency, renderValue]);
    if (!((_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.defaultAccount) || !fromWallet)
        return <></>;
    var toggleInputs = function () {
        var _a;
        if (uiLocked)
            return;
        setLockFormattingInputId(null);
        setIsTyping(false);
        var currentFocusedId = (_a = focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id) !== null && _a !== void 0 ? _a : null;
        var newFocusedId = currentFocusedId === ConvertInputType.FROM
            ? ConvertInputType.TO
            : ConvertInputType.FROM;
        var hasValidAmountToRecalc = moneyAmount && moneyAmount.amount > 0;
        if (hasValidAmountToRecalc) {
            toggleInitiated.current = true;
            setUiLocked(true);
        }
        pendingFocusId.current = newFocusedId;
        var newFromCurrency = toWallet.walletCurrency;
        var newToCurrency = fromWallet.walletCurrency;
        var baseTarget = newFocusedId === ConvertInputType.FROM
            ? inputValues.toInput
            : inputValues.fromInput;
        var newFocusedCurrency = newFocusedId === ConvertInputType.FROM ? newFromCurrency : newToCurrency;
        var targetAmount = hasValidAmountToRecalc
            ? moneyAmount
            : __assign(__assign({}, baseTarget.amount), { currency: newFocusedCurrency, currencyCode: newFocusedCurrency });
        setFocusedInputValues(__assign(__assign({}, baseTarget), { id: newFocusedId, isFocused: true, currency: newFocusedCurrency, amount: targetAmount }));
        setInputValues(function (prev) { return (__assign(__assign({}, prev), { fromInput: __assign(__assign({}, prev.toInput), { id: ConvertInputType.FROM, isFocused: newFocusedId === ConvertInputType.FROM }), toInput: __assign(__assign({}, prev.fromInput), { id: ConvertInputType.TO, isFocused: newFocusedId === ConvertInputType.TO }), currencyInput: __assign(__assign({}, prev.currencyInput), { isFocused: currentFocusedId === ConvertInputType.CURRENCY }) })); });
        setInputFormattedValues(function (prev) {
            if (!prev)
                return prev;
            return __assign(__assign({}, prev), { fromInput: __assign(__assign({}, prev.toInput), { id: ConvertInputType.FROM, isFocused: newFocusedId === ConvertInputType.FROM }), toInput: __assign(__assign({}, prev.fromInput), { id: ConvertInputType.TO, isFocused: newFocusedId === ConvertInputType.TO }), currencyInput: __assign(__assign({}, prev.currencyInput), { isFocused: currentFocusedId === ConvertInputType.CURRENCY }), formattedAmount: prev.formattedAmount });
        });
        if (!hasValidAmountToRecalc) {
            if (toggleWallet)
                toggleWallet();
            focusPhysically(newFocusedId);
            pendingFocusId.current = null;
        }
    };
    var btcWalletBalance = toBtcMoneyAmount((_f = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance) !== null && _f !== void 0 ? _f : NaN);
    var usdWalletBalance = toUsdMoneyAmount((_g = usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance) !== null && _g !== void 0 ? _g : NaN);
    var fromWalletBalance = fromWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance;
    var toWalletBalance = toWallet.walletCurrency === WalletCurrency.Btc ? btcWalletBalance : usdWalletBalance;
    var fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromWalletBalance });
    var fromSatsFormatted = fromWallet.walletCurrency === WalletCurrency.Usd &&
        displayCurrency === WalletCurrency.Usd
        ? null
        : moneyAmountToDisplayCurrencyString({ moneyAmount: fromWalletBalance });
    var toWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: toWalletBalance });
    var toSatsFormatted = toWallet.walletCurrency === WalletCurrency.Usd &&
        displayCurrency === WalletCurrency.Usd
        ? null
        : moneyAmountToDisplayCurrencyString({ moneyAmount: toWalletBalance });
    var amountFieldError = undefined;
    if (lessThan({
        value: fromWalletBalance,
        lessThan: settlementSendAmount,
    })) {
        amountFieldError = LL.SendBitcoinScreen.amountExceed({
            balance: fromWalletBalanceFormatted,
        });
    }
    var setAmountToBalancePercentage = function (percentage) {
        if (uiLocked)
            return;
        setUiLocked(true);
        setLoadingPercent(percentage);
        setInitialAmount(toWalletAmount({
            amount: Math.round((fromWallet.balance * percentage) / 100),
            currency: fromWallet.walletCurrency,
        }));
    };
    var moveToNextScreen = function () {
        navigation.navigate("conversionConfirmation", {
            fromWalletCurrency: fromWallet.walletCurrency,
            moneyAmount: moneyAmount,
        });
    };
    return (<Screen preset="fixed">
      <View style={styles.styleWalletContainer}>
        <View style={styles.walletSelectorContainer}>
          <Animated.View style={[
            styles.rowWrapTop,
            rowMinHeightStyle,
            getAnimatedBackground(ConvertInputType.FROM),
        ]} onLayout={setRowHeight("from")}>
            <WalletAmountRow inputRef={fromInputRef} value={renderValue(ConvertInputType.FROM)} placeholder={fromWallet.walletCurrency === WalletCurrency.Usd
            ? "$0"
            : "0 ".concat(BTC_SUFFIX)} selection={caretSelectionFor(ConvertInputType.FROM)} isLocked={uiLocked} onOverlayPress={function () {
            return overlaysReady && !uiLocked && handleInputPress(ConvertInputType.FROM);
        }} onFocus={function () {
            var _a;
            var baseInput = (_a = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.fromInput) !== null && _a !== void 0 ? _a : inputValues.fromInput;
            setFocusedInputValues(__assign(__assign({}, baseInput), { currency: fromWallet.walletCurrency, amount: __assign(__assign({}, baseInput.amount), { currency: fromWallet.walletCurrency, currencyCode: fromWallet.walletCurrency }) }));
        }} currency={fromWallet.walletCurrency} balancePrimary={fromWalletBalanceFormatted} balanceSecondary={fromSatsFormatted} pillContainerStyle={pillContainerStyle} pillOnLayout={onPillLayout(fromWallet.walletCurrency)} pillWrapperStyle={styles.topRowPillAlign} inputContainerStyle={styles.topRowInputAlign}/>
          </Animated.View>

          <View style={styles.walletSeparator} pointerEvents="box-none">
            <View style={[
            styles.line,
            ((focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id) === ConvertInputType.FROM ||
                (focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id) === ConvertInputType.TO) &&
                styles.lineHidden,
        ]} pointerEvents="none"/>
            <WalletToggleButton loading={toggleInitiated.current || isTyping || Boolean(loadingPercent)} disabled={!canToggleWallet || uiLocked} onPress={toggleInputs} containerStyle={styles.switchButton} testID="wallet-toggle-button"/>
          </View>

          <Animated.View style={[
            styles.rowWrapBottom,
            rowMinHeightStyle,
            getAnimatedBackground(ConvertInputType.TO),
        ]} onLayout={setRowHeight("to")}>
            <WalletAmountRow inputRef={toInputRef} value={renderValue(ConvertInputType.TO)} placeholder={fromWallet.walletCurrency === WalletCurrency.Usd
            ? "0 ".concat(BTC_SUFFIX)
            : "$0"} selection={caretSelectionFor(ConvertInputType.TO)} isLocked={uiLocked} onOverlayPress={function () {
            return overlaysReady && !uiLocked && handleInputPress(ConvertInputType.TO);
        }} onFocus={function () {
            var _a;
            var baseInput = (_a = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.toInput) !== null && _a !== void 0 ? _a : inputValues.toInput;
            setFocusedInputValues(__assign(__assign({}, baseInput), { currency: toWallet.walletCurrency, amount: __assign(__assign({}, baseInput.amount), { currency: toWallet.walletCurrency, currencyCode: toWallet.walletCurrency }) }));
        }} currency={toWallet.walletCurrency} balancePrimary={toWalletBalanceFormatted} balanceSecondary={toSatsFormatted} pillContainerStyle={pillContainerStyle} pillOnLayout={onPillLayout(toWallet.walletCurrency)}/>
          </Animated.View>
        </View>

        <View style={[styles.currencyInputContainer, uiLocked && styles.disabledOpacity]} pointerEvents={uiLocked ? "none" : "auto"}>
          {displayCurrency !== WalletCurrency.Usd && (<CurrencyInput value={renderValue(ConvertInputType.CURRENCY)} inputRef={currencyInputRef} isFocused={(focusedInputValues === null || focusedInputValues === void 0 ? void 0 : focusedInputValues.id) === ConvertInputType.CURRENCY} onFocus={function () {
                var _a;
                var baseInput = (_a = inputFormattedValues === null || inputFormattedValues === void 0 ? void 0 : inputFormattedValues.currencyInput) !== null && _a !== void 0 ? _a : inputValues.currencyInput;
                setFocusedInputValues(__assign(__assign({}, baseInput), { currency: DisplayCurrency, amount: __assign(__assign({}, baseInput.amount), { currency: DisplayCurrency, currencyCode: displayCurrency }) }));
            }} onChangeText={function () { }} currency={displayCurrency} placeholder={"".concat(getCurrencySymbol({ currency: displayCurrency }), "0")} AnimatedViewStyle={getAnimatedBackground(ConvertInputType.CURRENCY)}/>)}
        </View>

        <View style={styles.errorBoxWrapper}>
          {amountFieldError ? (<GaloyErrorBox errorMessage={amountFieldError}/>) : (<View style={styles.errorBoxSpacer}/>)}
        </View>
      </View>

      <View style={styles.bottomStack}>
        <PercentageSelector isLocked={uiLocked || toggleInitiated.current || isTyping || Boolean(loadingPercent)} loadingPercent={loadingPercent} onSelect={setAmountToBalancePercentage} testIdPrefix="convert" containerStyle={styles.percentageContainer}/>

        <View style={[styles.keyboardContainer, uiLocked && styles.disabledOpacity]} pointerEvents={uiLocked ? "none" : "auto"}>
          <AmountInputScreen inputValues={inputValues} convertMoneyAmount={convertMoneyAmount} onAmountChange={handleSetMoneyAmount} onSetFormattedAmount={onSetFormattedValues} focusedInput={focusedInputValues} initialAmount={initialAmount} compact debounceMs={1000} lockFormattingUntilBlur={Boolean(lockFormattingInputId)} onTypingChange={function (typing, focusedId) {
            setIsTyping(typing);
            setTypingInputId(typing ? focusedId : null);
            if (typing && focusedId)
                setLockFormattingInputId(focusedId);
        }} onAfterRecalc={function () {
            setUiLocked(false);
            setLoadingPercent(null);
            if (toggleInitiated.current) {
                toggleInitiated.current = false;
                if (toggleWallet)
                    toggleWallet();
                if (moneyAmount)
                    handleSetMoneyAmount(moneyAmount);
                var id = pendingFocusId.current;
                if (id) {
                    focusPhysically(id);
                    pendingFocusId.current = null;
                }
            }
        }}/>
        </View>

        <GaloyPrimaryButton title={LL.ConversionDetailsScreen.reviewTransfer()} containerStyle={styles.buttonContainer} disabled={!isValidAmount ||
            uiLocked ||
            toggleInitiated.current ||
            isTyping ||
            Boolean(loadingPercent)} onPress={moveToNextScreen} testID="next-button"/>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a, currencyInput) {
    var colors = _a.colors;
    return ({
        iconSlotContainer: {
            width: 30,
            height: 22,
            justifyContent: "center",
            alignItems: "center",
        },
        styleWalletContainer: __assign({ flexDirection: "column", marginHorizontal: 20, marginTop: 16 }, (currencyInput ? { minHeight: 70 } : {})),
        walletSelectorContainer: {
            flexDirection: "column",
            backgroundColor: colors.grey5,
            borderRadius: 13,
            paddingHorizontal: 15,
            paddingTop: 0,
            paddingBottom: 0,
            overflow: "hidden",
            position: "relative",
        },
        rowWrapTop: {
            marginHorizontal: -15,
            paddingHorizontal: 15,
            paddingBottom: 6,
        },
        topRowInputAlign: {
            alignSelf: "flex-start",
            paddingTop: 18,
        },
        topRowPillAlign: {
            marginTop: 11,
        },
        rowWrapBottom: {
            marginHorizontal: -15,
            paddingHorizontal: 15,
            paddingTop: 6,
            paddingBottom: 10,
        },
        walletSeparator: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            marginVertical: 0,
            zIndex: 2,
        },
        lineHidden: { opacity: 0 },
        line: { backgroundColor: colors.grey4, height: 1, flex: 1 },
        switchButton: {
            position: "absolute",
            left: 100,
        },
        currencyInputContainer: {
            marginTop: 10,
        },
        bottomStack: {
            flex: 1,
            justifyContent: "flex-end",
        },
        percentageContainer: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
            marginVertical: 10,
            gap: 12,
        },
        keyboardContainer: {
            maxWidth: 450,
            paddingHorizontal: 45,
            paddingTop: 15,
            paddingBottom: 32,
        },
        disabledOpacity: { opacity: 0.5 },
        buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
        errorBoxWrapper: { marginTop: 8 },
        errorBoxSpacer: { height: 44 },
    });
});
var templateObject_1;
//# sourceMappingURL=conversion-details-screen.js.map