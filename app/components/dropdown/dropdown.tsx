import React, { useState } from "react"
import { View, TouchableOpacity, TouchableWithoutFeedback } from "react-native"
import ReactNativeModal from "react-native-modal"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"

export interface DropdownOption<T = string> {
  value: T
  label: string
  description?: string
}

interface DropdownProps<T = string> {
  options: DropdownOption<T>[]
  selectedValue?: T
  onValueChange?: (value: T) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  testID?: string
}

export const DropdownComponent: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onValueChange,
  placeholder,
  loading = false,
  disabled = false,
  testID,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [isModalVisible, setModalVisible] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<string | null>(null)

  const toggleModal = () => setModalVisible((visible) => !visible)

  const handleSelect = (value: string) => {
    toggleModal()
    setPendingSelection(value)
  }

  const handleModalHide = () => {
    if (pendingSelection !== null) {
      onValueChange?.(pendingSelection)
      setPendingSelection(null)
    }
  }

  const currentOption = options.find((opt) => opt.value === selectedValue)
  const displayText = currentOption?.label || placeholder

  const isDisabled = loading || disabled

  return (
    <>
      <TouchableWithoutFeedback
        onPress={isDisabled ? undefined : toggleModal}
        testID={testID}
      >
        <View style={[styles.fieldBackground, isDisabled && styles.disabled]}>
          <View style={styles.contentContainer}>
            <Text type="p2" style={[currentOption?.label ? {} : styles.placeholderText]}>
              {displayText}
            </Text>
            {currentOption?.description && (
              <Text style={styles.descriptionText} type="p3">
                {currentOption.description}
              </Text>
            )}
          </View>

          <View style={styles.iconContainer}>
            <Icon name="chevron-down" size={24} color={colors.primary} />
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
          {options.map((option, index) => (
            <TouchableOpacity key={index} onPress={() => handleSelect(option.value)}>
              <View
                style={[
                  styles.optionContainer,
                  option.value === selectedValue && styles.selectedOption,
                ]}
              >
                <View style={styles.optionContent}>
                  <Text type="p2">{option.label}</Text>
                  {option.description && (
                    <Text style={styles.optionDescription} type="p4">
                      {option.description}
                    </Text>
                  )}
                </View>
                {option.value === selectedValue && (
                  <Icon name="checkmark" size={24} color={colors.primary} />
                )}
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 60,
    borderRadius: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  descriptionText: {
    color: colors.grey1,
    marginTop: 2,
  },
  placeholderText: {
    color: colors.grey3,
  },
  iconContainer: {
    marginLeft: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  modal: {
    marginBottom: "90%",
  },
  optionContainer: {
    flexDirection: "row",
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
    minHeight: 60,
  },
  selectedOption: {
    backgroundColor: colors.grey4,
  },
  optionContent: {
    flex: 1,
  },
  optionDescription: {
    color: colors.grey1,
    marginTop: 2,
  },
}))
