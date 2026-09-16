import React, { useState } from "react"
import {
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native"
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
  /** Shows a spinner in place of the caret while the fees are being quoted. */
  loading?: boolean
}

export const FeeTierSelector = <T extends string>({
  title,
  options,
  selected,
  onSelect,
  loading = false,
}: FeeTierSelectorProps<T>): React.ReactElement => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const [isModalVisible, setModalVisible] = useState(false)

  const selectedOption = options.find((o) => o.id === selected)

  return (
    <>
      <TouchableWithoutFeedback
        onPress={() => setModalVisible(true)}
        {...testProps("fee-tier-dropdown")}
      >
        {/* Sized like the note field below it (NoteInput, not big), so the two rows match. */}
        <View style={styles.fieldBackground}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.content}>
            <Text style={styles.selectedLabel}>{selectedOption?.label}</Text>
            {Boolean(selectedOption?.detail) && (
              <Text style={styles.selectedDetail}>{selectedOption?.detail}</Text>
            )}
          </View>
          <View style={styles.iconContainer}>
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                {...testProps("fee-tier-spinner")}
              />
            ) : (
              <GaloyIcon name="caret-down" size={16} color={colors.primary} />
            )}
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
    lineHeight: 20,
    color: colors.black,
    flexShrink: 1,
  },
  fieldBackground: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    columnGap: 12,
    minHeight: 50,
    paddingHorizontal: 10,
  },
  content: {
    flex: 1,
    alignItems: "flex-end",
  },
  selectedLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "right",
  },
  selectedDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.grey2,
    textAlign: "right",
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
