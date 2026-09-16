import React, { useState } from "react"
import { TouchableOpacity, TouchableWithoutFeedback, View } from "react-native"
import ReactNativeModal from "react-native-modal"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"
import { fonts } from "@app/rne-theme/fonts"

type OptionItem<T extends string> = {
  id: T
  label: string
  detail: string
}

type FeeTierSelectorProps<T extends string> = {
  title: string
  options: OptionItem<T>[]
  selected: T
  onSelect: (id: T) => void
}

export const FeeTierSelector = <T extends string>({
  title,
  options,
  selected,
  onSelect,
}: FeeTierSelectorProps<T>): React.ReactElement => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const [isModalVisible, setModalVisible] = useState(false)

  const selectedOption = options.find((o) => o.id === selected)
  const selectedValue = [selectedOption?.label, selectedOption?.detail]
    .filter(Boolean)
    .join(" ")

  /**
   * One root, because the modal keeps a wrapper view mounted while hidden: returned as a
   * sibling, it would take its own slot in the parent's gap and double the space below.
   */
  return (
    <View>
      {/* The whole row is the tap target, so it carries no chevron. */}
      <TouchableWithoutFeedback
        onPress={() => setModalVisible(true)}
        {...testProps("fee-tier-dropdown")}
      >
        <View style={styles.row}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{selectedValue}</Text>
        </View>
      </TouchableWithoutFeedback>

      <ReactNativeModal
        style={styles.modal}
        animationInTiming={200}
        animationOutTiming={200}
        animationIn="fadeInDown"
        animationOut="fadeOutUp"
        isVisible={isModalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
      >
        <View style={styles.options}>
          {options.map((option) => {
            const isSelected = option.id === selected

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  onSelect(option.id)
                  setModalVisible(false)
                }}
                {...testProps(`fee-tier-${option.id}`)}
              >
                <View style={[styles.optionRow, isSelected && styles.optionRowSelected]}>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {Boolean(option.detail) && (
                      <Text style={styles.optionDetail}>{option.detail}</Text>
                    )}
                  </View>
                  {isSelected && (
                    <GaloyIcon name="check-circle" size={16} color={colors._green} />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ReactNativeModal>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 12,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  /** Shrinks and wraps alongside the heading, so a long locale never cuts the ETA off. */
  value: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "right",
  },
  modal: {
    marginBottom: "70%",
  },
  options: {
    rowGap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
  },
  optionRowSelected: {
    backgroundColor: colors.grey4,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  optionDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
}))
