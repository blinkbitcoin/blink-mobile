import React, { useCallback, useRef, useState } from "react"
import { ScrollView, TouchableOpacity, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import ReactNativeModal from "react-native-modal"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

const ITEM_HEIGHT = 56
const MODAL_MAX_HEIGHT = 400

export type YearOption = {
  year: number
  itemCount?: number
  disabled?: boolean
}

type YearSelectorProps = {
  years: YearOption[]
  selectedYear: number
  onYearChange: (year: number) => void
  itemLabel?: (count: number) => string
}

type YearOptionItemProps = {
  yearOption: YearOption
  isSelected: boolean
  isDisabled: boolean
  itemLabel?: (count: number) => string
  onPress: () => void
}

const YearOptionItem: React.FC<YearOptionItemProps> = ({
  yearOption,
  isSelected,
  isDisabled,
  itemLabel,
  onPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const hasItemCount = yearOption.itemCount !== undefined

  return (
    <TouchableOpacity
      style={[styles.yearOption, isDisabled && styles.yearOptionDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      <GaloyIcon
        name="calendar"
        size={20}
        color={isDisabled ? colors.grey3 : colors.black}
      />
      <View style={styles.yearOptionContent}>
        <Text
          style={[
            styles.yearOptionText,
            isSelected && styles.yearOptionSelected,
            isDisabled && styles.yearOptionTextDisabled,
          ]}
        >
          {yearOption.year}
        </Text>
        {hasItemCount && itemLabel && (
          <Text
            style={[
              styles.yearOptionSubtext,
              isDisabled && styles.yearOptionTextDisabled,
            ]}
          >
            {itemLabel(yearOption.itemCount ?? 0)}
          </Text>
        )}
      </View>
      {isSelected && !isDisabled && (
        <GaloyIcon name="check" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  )
}

export const YearSelector: React.FC<YearSelectorProps> = ({
  years,
  selectedYear,
  onYearChange,
  itemLabel,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [isModalVisible, setModalVisible] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  const openModal = useCallback(() => setModalVisible(true), [])
  const closeModal = useCallback(() => setModalVisible(false), [])

  const scrollToSelected = useCallback(() => {
    const index = years.findIndex((y) => y.year === selectedYear)
    if (index > 0) {
      scrollViewRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false })
    }
  }, [years, selectedYear])

  const handleYearSelect = useCallback(
    (yearOption: YearOption) => {
      if (yearOption.disabled) return
      onYearChange(yearOption.year)
      closeModal()
    },
    [onYearChange, closeModal],
  )

  const isYearDisabled = useCallback((yearOption: YearOption): boolean => {
    const hasItemCount = yearOption.itemCount !== undefined
    return yearOption.disabled === true || (hasItemCount && yearOption.itemCount === 0)
  }, [])

  return (
    <>
      <TouchableOpacity style={styles.yearSelector} onPress={openModal}>
        <GaloyIcon name="calendar" size={20} color={colors.black} />
        <Text style={styles.yearText}>{selectedYear}</Text>
        <GaloyIcon name="caret-down" size={20} color={colors.primary} />
      </TouchableOpacity>

      <ReactNativeModal
        isVisible={isModalVisible}
        onBackdropPress={closeModal}
        onBackButtonPress={closeModal}
        onModalShow={scrollToSelected}
        animationIn="slideInDown"
        animationOut="slideOutUp"
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
            {years.map((yearOption) => {
              const isSelected = selectedYear === yearOption.year
              const isDisabled = isYearDisabled(yearOption)

              return (
                <YearOptionItem
                  key={yearOption.year}
                  yearOption={yearOption}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  itemLabel={itemLabel}
                  onPress={() => handleYearSelect(yearOption)}
                />
              )
            })}
          </ScrollView>
        </View>
      </ReactNativeModal>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 10,
  },
  yearText: {
    flex: 1,
    color: colors.black,
    fontSize: 18,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 24,
  },
  modal: {
    justifyContent: "flex-start",
    marginTop: 150,
  },
  modalContent: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 10,
    maxHeight: MODAL_MAX_HEIGHT,
  },
  yearOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 10,
    minHeight: ITEM_HEIGHT,
    borderRadius: 8,
  },
  yearOptionDisabled: {
    opacity: 0.5,
  },
  yearOptionContent: {
    flex: 1,
    gap: 2,
  },
  yearOptionText: {
    color: colors.black,
    fontSize: 18,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 24,
  },
  yearOptionSelected: {
    color: colors.primary,
  },
  yearOptionTextDisabled: {
    color: colors.grey3,
  },
  yearOptionSubtext: {
    color: colors.grey2,
    fontSize: 12,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 16,
  },
}))
