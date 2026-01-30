import React, { useState } from "react";
import { View, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import ReactNativeModal from "react-native-modal";
import Icon from "react-native-vector-icons/Ionicons";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
import { WalletCurrency } from "@app/graphql/generated";
import { CurrencyPill, useEqualPillWidth } from "../atomic/currency-pill";
export var WalletFilterDropdown = function (_a) {
    var _b = _a.selected, selected = _b === void 0 ? "ALL" : _b, onSelectionChange = _a.onSelectionChange, _c = _a.loading, loading = _c === void 0 ? false : _c;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var _d = useState(false), isModalVisible = _d[0], setModalVisible = _d[1];
    var _e = useState(null), pendingSelection = _e[0], setPendingSelection = _e[1];
    var _f = useEqualPillWidth(), pillWidthStyle = _f.widthStyle, onPillLayout = _f.onPillLayout;
    var toggleModal = function () { return setModalVisible(function (visible) { return !visible; }); };
    var handleSelect = function (selectedValue) {
        toggleModal();
        setPendingSelection(selectedValue);
    };
    var handleModalHide = function () {
        if (pendingSelection !== null) {
            onSelectionChange === null || onSelectionChange === void 0 ? void 0 : onSelectionChange(pendingSelection);
            setPendingSelection(null);
        }
    };
    var walletOptions = [
        {
            value: "ALL",
            label: LL.common.all(),
            description: LL.common.allAccounts(),
        },
        {
            value: WalletCurrency.Btc,
            label: WalletCurrency.Btc,
            description: LL.common.bitcoin(),
        },
        {
            value: WalletCurrency.Usd,
            label: WalletCurrency.Usd,
            description: LL.common.dollar(),
        },
    ];
    var current = walletOptions.find(function (opt) { return opt.value === (pendingSelection || selected); });
    if (!current)
        return null;
    var isCurrencyOption = function (value) {
        return value !== "ALL";
    };
    return (<>
      <TouchableWithoutFeedback onPress={loading ? undefined : toggleModal} testID="wallet-filter-dropdown">
        <View style={[styles.fieldBackground, loading && styles.disabled]}>
          <View style={styles.walletSelectorTypeContainer}>
            <CurrencyPill currency={current.value} containerSize="medium" label={current.value === "ALL" ? current.description : undefined} containerStyle={isCurrencyOption(current.value) ? pillWidthStyle : undefined} onLayout={isCurrencyOption(current.value) ? onPillLayout(current.value) : undefined}/>
          </View>

          <View style={styles.pickWalletIcon}>
            <Icon name="chevron-down" size={24} color={colors.black}/>
          </View>
        </View>
      </TouchableWithoutFeedback>

      <ReactNativeModal style={styles.modal} animationInTiming={200} animationOutTiming={200} animationIn="fadeInDown" animationOut="fadeOutUp" isVisible={isModalVisible} onBackdropPress={toggleModal} onBackButtonPress={toggleModal} onModalHide={handleModalHide}>
        <View>
          {walletOptions.map(function (opt) { return (<TouchableOpacity key={opt.value} onPress={function () {
                handleSelect(opt.value);
            }}>
              <View style={styles.walletContainer}>
                <View style={styles.walletSelectorTypeContainer}>
                  <CurrencyPill currency={opt.value} containerSize="medium" label={opt.value === "ALL" ? opt.description : undefined} containerStyle={isCurrencyOption(opt.value) ? pillWidthStyle : undefined} onLayout={isCurrencyOption(opt.value) ? onPillLayout(opt.value) : undefined}/>
                </View>
              </View>
            </TouchableOpacity>); })}
        </View>
      </ReactNativeModal>
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        fieldBackground: {
            flexDirection: "row",
            backgroundColor: colors.grey5,
            justifyContent: "space-between",
            alignItems: "center",
            padding: 14,
            minHeight: 60,
        },
        walletContainer: {
            flexDirection: "row",
            backgroundColor: colors.grey5,
            paddingHorizontal: 14,
            borderRadius: 10,
            alignItems: "center",
            marginBottom: 10,
            minHeight: 60,
        },
        walletSelectorTypeContainer: {
            marginRight: 20,
        },
        walletSelectorTypeLabelAll: {
            height: 30,
            width: 50,
            backgroundColor: "transparent",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.primary3,
            justifyContent: "center",
            alignItems: "center",
        },
        walletSelectorTypeLabelBtcText: {
            fontWeight: "bold",
            color: colors.white,
        },
        walletSelectorTypeLabelAllText: {
            fontWeight: "bold",
            color: colors.primary3,
        },
        walletSelectorTypeTextContainer: {
            flex: 1,
            justifyContent: "center",
        },
        modal: {
            marginBottom: "90%",
        },
        pickWalletIcon: {
            marginRight: 12,
        },
        disabled: {
            opacity: 0.5,
        },
    });
});
//# sourceMappingURL=wallet-filter-dropdown.js.map