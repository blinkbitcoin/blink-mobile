import React from "react"
import { View, Linking } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"
import { FieldWithEventProps } from "./field-with-icon.props"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type TTextWithUrl = {
  text: string
  url?: string
}

export const FieldWithEvent = ({ title, value, subValue }: FieldWithEventProps) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const handleTextWithUrl = (text: string): TTextWithUrl => {
    const regex = /(https?:\/\/[^\s]+)/i
    const match = text.match(regex)
    if (match) {
      const url = match[0]
      const textWithoutURL = text.replace(url, "").trim()
      return { text: textWithoutURL, url }
    }
    return { text }
  }

  const textData = handleTextWithUrl(value)
  const valueData = textData.url ? `${textData.text} ` : textData.text

  return (
    <View style={styles.successActionFieldContainer}>
      <Text style={styles.titleFieldBackground} type={"p3"}>
        {title}
      </Text>
      <View style={styles.fieldBackground}>
        <View>
          <Text style={styles.inputStyle} type={"p3"}>
            {valueData}
            {textData.url && (
              <Text
                {...testProps(LL.ScanningQRCodeScreen.openLinkTitle())}
                style={styles.inputUrl}
                onPress={() => Linking.openURL(textData.url!)}
              >
                {textData.url}
              </Text>
            )}
          </Text>
          {subValue && (
            <Text
              type={"p3"}
              style={[styles.inputStyle, styles.subValueStyle]}
            >{`(${subValue})`}</Text>
          )}
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  successActionFieldContainer: {
    flexDirection: "row",
    overflow: "hidden",
    alignItems: "flex-start",
  },
  titleFieldBackground: {
    fontWeight: "300",
    fontStyle: "normal",
    color: colors.grey2,
    minWidth: 80,
  },
  fieldBackground: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    color: colors.black,
  },
  inputStyle: {
    color: colors.black,
    textAlign: "right",
  },
  inputUrl: {
    color: colors.primary,
  },
  subValueStyle: {
    marginTop: 2,
  },
}))
