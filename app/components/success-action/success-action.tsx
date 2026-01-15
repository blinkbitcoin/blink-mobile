import React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { FieldWithEvent } from "./field-with-icon"

type SuccessActionComponentProps = {
  visible?: boolean
  title: string
  text?: string | null
  subValue?: string
}

export enum SuccessActionTag {
  AES = "aes",
  MESSAGE = "message",
  URL = "url",
}

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  visible,
  title,
  text,
  subValue,
}) => {
  const styles = useStyles()

  if (!visible || !text) {
    return <></>
  }
  return (
    <View style={styles.fieldContainer}>
      <FieldWithEvent title={title} value={text} subValue={subValue} />
    </View>
  )
}
const useStyles = makeStyles(() => ({
  fieldContainer: {
    minWidth: "100%",
  },
}))
