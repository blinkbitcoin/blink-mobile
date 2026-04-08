import React from "react"

import { makeStyles, Text } from "@rn-vui/themed"

type RichTextProps = {
  text: string
  bold: string
}

export const RichText: React.FC<RichTextProps> = ({ text, bold }) => {
  const styles = useStyles()

  if (!text.includes(bold)) {
    return <Text style={styles.body}>{text}</Text>
  }

  const [before, after] = text.split(bold)

  return (
    <Text style={styles.body}>
      {before}
      <Text style={styles.bold}>{bold}</Text>
      {after}
    </Text>
  )
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
}))
