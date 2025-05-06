import { View } from "react-native"
import { Icon } from 'react-native-elements'
// import Icon from "react-native-vector-iconS/Ionicons"
import * as React from "react"
import EStyleSheet from "react-native-extended-stylesheet"

const styles = EStyleSheet.create({
  icon: {
    fontSize: "72rem",
  },

  iconContainer: {
    alignItems: "flex-end",
    padding: "6rem",
    position: "absolute",
    right: "8rem",
    top: "16rem",
  },
})

type Props = {
  onPress: () => void
  color: string
}

export const CloseCross: React.FC<Props> = ({ onPress, color }: Props) => (
  <View style={styles.iconContainer}>
    <Icon name="close" style={styles.icon} onPress={onPress} color={color} />
  </View>
)
