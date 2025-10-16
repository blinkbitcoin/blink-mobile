import React, { useState } from "react"
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from "react-native"
import ReactNativeModal from "react-native-modal"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { WalletCurrency } from "@app/graphql/generated"
import { GaloyCurrencyBubbleText } from "../atomic/galoy-currency-bubble-text"

export type WalletValues = WalletCurrency | "ALL"

export const WalletFilterDropdown: React.FC<{
  selected?: WalletValues
  onSelectionChange?: (value: WalletValues) => void
  loading?: boolean
}> = ({ selected = "ALL", onSelectionChange, loading = false }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const [isModalVisible, setModalVisible] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<WalletValues | null>(null)
  const toggleModal = () => setModalVisible((visible) => !visible)

  const handleSelect = (selectedValue: WalletValues) => {
    toggleModal()
    setPendingSelection(selectedValue)
  }

  const handleModalHide = () => {
    if (pendingSelection !== null) {
      onSelectionChange?.(pendingSelection)
      setPendingSelection(null)
    }
  }

  const walletOptions = [
    {
      value: "ALL",
      label: LL.common.all() as WalletValues,
      description: LL.common.allAccounts(),
    },
    {
      value: "BTC",
      label: WalletCurrency.Btc as WalletValues,
      description: LL.common.bitcoin(),
    },
    {
      value: "USD",
      label: WalletCurrency.Usd as WalletValues,
      description: LL.common.dollar(),
    },
  ] as const

  const current = walletOptions.find(
    (opt) => opt.value === (pendingSelection || selected),
  )
  if (!current) return null

  return (
    <>
      <TouchableWithoutFeedback
        onPress={loading ? undefined : toggleModal}
        testID="wallet-filter-dropdown"
      >
        <View style={[styles.fieldBackground, loading && styles.disabled]}>
          <View style={styles.walletSelectorTypeContainer}>
            <GaloyCurrencyBubbleText
              currency={current.label}
              textSize="p2"
              containerSize="medium"
            />
          </View>

          <View style={styles.walletSelectorTypeTextContainer}>
            <Text style={styles.walletCurrencyText}>{current.description}</Text>
          </View>

          <View style={styles.pickWalletIcon}>
            <Icon name="chevron-down" size={24} color={colors.black} />
          </View>
        </View>
      </TouchableWithoutFeedback>

      <ReactNativeModal
        style={styles.modal}
        animationInTiming={200}
        animationOutTiming={200}
        animationIn="fadeInDown"
        animationOut="fadeOutUp"
        isVisible={isModalVisible}
        onBackdropPress={toggleModal}
        onBackButtonPress={toggleModal}
        onModalHide={handleModalHide}
      >
        <View>
          {walletOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                handleSelect(opt.value)
              }}
            >
              <View style={styles.walletContainer}>
                <View style={styles.walletSelectorTypeContainer}>
                  <GaloyCurrencyBubbleText
                    currency={opt.label}
                    textSize="p2"
                    containerSize="medium"
                  />
                </View>
                <Text style={styles.walletCurrencyText}>{opt.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ReactNativeModal>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  fieldBackground: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
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
  walletCurrencyText: {
    fontWeight: "bold",
    fontSize: 18,
    color: colors.black,
    marginBottom: 1,
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
}))
