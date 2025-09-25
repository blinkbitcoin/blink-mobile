import React from "react"
import { View } from "react-native"
import { SuccessActionComponentProps } from "./success-action.props"
import { FieldWithEvent } from "./field-with-icon"
import { makeStyles } from "@rn-vui/themed"

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  visible,
  title,
  text,
  subText,
}) => {
  const styles = useStyles()

  if (!visible) {
    return <></>
  }
  return (
    <View style={styles.fieldContainer}>
      <FieldWithEvent title={title} value={text!} subValue={subText} />
    </View>
  )
}
const useStyles = makeStyles(() => ({
  fieldContainer: {
    minWidth: "100%",
  },
}))
