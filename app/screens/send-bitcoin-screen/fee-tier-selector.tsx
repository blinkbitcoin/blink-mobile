import React, { useState } from "react"
import { TouchableOpacity, TouchableWithoutFeedback, View } from "react-native"
import ReactNativeModal from "react-native-modal"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

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

  return (
    <>
      <Text style={styles.title}>{title}</Text>
      <TouchableWithoutFeedback
        onPress={() => setModalVisible(true)}
        {...testProps("fee-tier-dropdown")}
      >
        <View style={styles.fieldBackground}>
          <View style={styles.content}>
            <Text style={styles.selectedLabel}>{selectedOption?.label}</Text>
            {Boolean(selectedOption?.detail) && (
              <Text style={styles.selectedDetail}>{selectedOption?.detail}</Text>
            )}
          </View>
          <View style={styles.iconContainer}>
            <GaloyIcon name="caret-down" size={24} color={colors.primary} />
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
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
      >
        <View>
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
                    <GaloyIcon name="check" size={16} color={colors.primary} />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ReactNativeModal>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
    marginBottom: 6,
  },
  fieldBackground: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
  },
  selectedDetail: {
    fontSize: 13,
    color: colors.grey2,
    marginTop: 2,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    marginBottom: "70%",
  },
  optionRow: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionRowSelected: {
    backgroundColor: colors.grey4,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  optionDetail: {
    fontSize: 13,
    color: colors.grey2,
    marginTop: 2,
  },
}))
