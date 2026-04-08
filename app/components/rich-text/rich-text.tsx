import React from "react"
import { StyleProp, TextStyle } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

type TagHandler = {
  style?: StyleProp<TextStyle>
  onPress?: () => void
}

type RichTextProps = {
  text: string
  tags?: Record<string, TagHandler>
  style?: StyleProp<TextStyle>
}

const SPLIT_PATTERN = /(<\w+>.*?<\/\w+>)/g
const TAG_PATTERN = /^<(\w+)>(.*)<\/\1>$/

export const RichText: React.FC<RichTextProps> = ({ text, tags, style }) => {
  const styles = useStyles()

  const allTags: Record<string, TagHandler> = {
    bold: { style: styles.bold },
    link: { style: styles.link },
    ...tags,
  }

  const parts = text.split(SPLIT_PATTERN).map((part, i) => {
    const match = part.match(TAG_PATTERN)
    if (!match) return part

    const [, tag, inner] = match
    const handler = allTags[tag]
    return (
      <Text key={i} style={handler?.style} onPress={handler?.onPress}>
        {inner}
      </Text>
    )
  })

  return <Text style={[styles.body, style]}>{parts}</Text>
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.grey2,
  },
  bold: {
    fontWeight: "700",
    color: colors.black,
  },
  link: {
    textDecorationLine: "underline",
    color: colors.black,
  },
}))
