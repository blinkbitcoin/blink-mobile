import React from "react"
import { View, Text, TouchableOpacity, TextInput, Linking } from "react-native"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { makeStyles, useTheme } from "@rneui/themed"
import { FieldWithIconProps } from "./field-with-icon.props"
import Clipboard from "@react-native-clipboard/clipboard"
import { toastShow } from "@app/utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type TTextWithUrl = {
  text: string
  url?: string
}
export const FieldWithIconEvent = ({ title, value, iconName }: FieldWithIconProps) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const {
    theme: { colors },
  } = useTheme()
  const [inputText, setInputText] = React.useState<string>(() => value)
  const [isEditing, setIsEditing] = React.useState<boolean>(false)

  const handleTextWithUrl = (text: string): TTextWithUrl => {
    const regex = /(https?:\/\/[^\s]+)/i
    const match = text.match(regex)

    if (match) {
      const url = match[0]
      const textoSinURL = text.replace(url, "").trim()
      return { text: textoSinURL, url }
    }
    return { text }
  }

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text)
    toastShow({
      type: "success",
      message: LL.SendBitcoinScreen.copiedSuccessMessage(),
      LL,
    })
  }

  const handleEvent = () => {
    if (iconName === "copy-paste") {
      let value = null
      if (handleTextWithUrl(inputText)?.url) {
        value = `${handleTextWithUrl(inputText).text} ${handleTextWithUrl(inputText).url}`
        copyToClipboard(value)
        return
      }
      copyToClipboard(handleTextWithUrl(inputText).text)
      return
    }
    if (iconName === "pencil") {
      setIsEditing((prev) => !prev)
    }
  }
  return (
    <View style={styles.successActionFieldContainer}>
      {title && <Text style={styles.titleFieldBackground}>{title}</Text>}
      <View style={styles.fieldBackground}>
        {isEditing ? (
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            onBlur={() => setIsEditing(false)}
            style={styles.editingInput}
            autoFocus
          />
        ) : (
          <View>
            {handleTextWithUrl(inputText).text && (
              <Text style={styles.inputStyle}>{handleTextWithUrl(inputText).text}</Text>
            )}
            {handleTextWithUrl(inputText).url && (
              <TouchableOpacity
                {...testProps(LL.ScanningQRCodeScreen.openLinkTitle())}
                onPress={() => Linking.openURL(handleTextWithUrl(inputText).url!)}
                hitSlop={23}
              >
                <Text style={styles.inputUlr}>{handleTextWithUrl(inputText).url}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {iconName && (
        <TouchableOpacity style={styles.iconContainer} onPress={handleEvent} hitSlop={30}>
          <GaloyIcon name={iconName} size={23} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  successActionFieldContainer: {
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    padding: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  titleFieldBackground: {
    fontSize: 14,
    color: colors.black,
    width: 80,
  },
  fieldBackground: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    fontSize: 14,
    color: colors.black,
  },
  editingInput: {
    padding: 0,
    margin: 0,
  },
  inputStyle: {
    fontSize: 14,
    color: colors.black,
  },
  inputUlr: {
    fontSize: 14,
    color: colors.primary,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
}))
