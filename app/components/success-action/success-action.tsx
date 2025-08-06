import React from "react"
import { View } from "react-native"
import { SuccessActionComponentProps } from "./success-action.props"
import { FieldWithIconEvent } from "./field-with-icon"
import { makeStyles } from "@rneui/themed"

export const SuccessActionComponent: React.FC<SuccessActionComponentProps> = ({
  visible,
  icon,
  title,
  text,
}) => {
  const styles = useStyles()

  if (!visible) {
    return <></>
  }
  return (
    <View style={styles.fieldContainer}>
      <FieldWithIconEvent title={title} value={text!} iconName={icon} />
    </View>
  )
}
const useStyles = makeStyles(() => ({
  fieldContainer: {
    minWidth: "100%",
  },
}))
