import * as React from "react"
import { TouchableOpacity, View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

const useStyles = makeStyles(() => ({
  iconContainer: {
    alignItems: "flex-end",
    padding: 6,
    position: "absolute",
    right: 8,
    top: 16,
  },
}))

type Props = {
  onPress: () => void
  color: string
}

export const CloseCross: React.FC<Props> = ({ onPress, color }) => {
  const styles = useStyles()

  return (
    <View style={styles.iconContainer}>
      <TouchableOpacity onPress={onPress}>
        <GaloyIcon name="close" size={72} color={color} />
      </TouchableOpacity>
    </View>
  )
}
