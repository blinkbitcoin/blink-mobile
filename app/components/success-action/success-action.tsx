import React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { SuccessActionComponentProps } from "./success-action.props"
import { FieldWithEvent } from "./field-with-icon"

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  visible,
  title,
  text,
  subValue,
}) => {
  const styles = useStyles()

  if (!visible) {
    return <></>
  }
  return (
    <View style={styles.fieldContainer}>
      <FieldWithEvent title={title} value={text!} subValue={subValue} />
    </View>
  )
}
const useStyles = makeStyles(() => ({
  fieldContainer: {
    minWidth: "100%",
  },
}))
