import React, { useEffect, useState } from "react"
import { TextInput, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"

type EditFieldModalProps = {
  isVisible: boolean
  toggleModal: () => void
  fieldName: string
  initialValue: string
  onSave: (newValue: string) => void
}

export const EditFieldModal: React.FC<EditFieldModalProps> = ({
  isVisible,
  toggleModal,
  fieldName,
  initialValue,
  onSave,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (isVisible) {
      setValue(initialValue)
    }
  }, [isVisible, initialValue])

  const hasChanges = value !== initialValue
  const isValid = value.trim().length > 0

  const handleSave = () => {
    if (hasChanges && isValid) {
      onSave(value.trim())
      toggleModal()
    }
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      headerTitle={fieldName}
      body={
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            placeholderTextColor={colors.grey2}
            selectionColor={colors.primary}
            accessibilityLabel={fieldName}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>
      }
      primaryButtonTitle={LL.common.save()}
      primaryButtonOnPress={handleSave}
      primaryButtonDisabled={!hasChanges || !isValid}
      secondaryButtonTitle={LL.common.cancel()}
      secondaryButtonOnPress={toggleModal}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  inputContainer: {
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.grey4,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    color: colors.black,
    minHeight: 50,
  },
}))
