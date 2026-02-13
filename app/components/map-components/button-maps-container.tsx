import { TouchableOpacity, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  event?: () => void
  children?: JSX.Element
  position: "topCenter" | "LeftLv1" | "LeftLv2"
  iconName?: string
}

export default function ButtonMapsContainer({
  event,
  children,
  position,
  iconName,
}: Props) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  const {
    theme: { colors },
  } = useTheme()
  const getPositionStyle = (position: "topCenter" | "LeftLv1" | "LeftLv2") => {
    switch (position) {
      case "topCenter":
        return { ...styles.topCenter, top: insets.top + 8 }
      case "LeftLv1":
        return { ...styles.LeftLv1, top: insets.top + 8 }
      case "LeftLv2":
        return { ...styles.LeftLv2, top: insets.top + 56 }
      default:
        return {}
    }
  }
  return (
    <View style={{ ...styles.container, ...getPositionStyle(position) }}>
      <TouchableOpacity onPress={event}>
        {iconName ? (
          <Icon color={colors.primary} name={iconName} size={22} style={styles.icon} />
        ) : (
          children
        )}
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    zIndex: 99,
    position: "absolute",
    borderRadius: 100,
    backgroundColor: `${colors.grey2}50`,
    padding: 8,
  },
  topCenter: {
    alignSelf: "center",
  },
  LeftLv1: {
    left: 8,
    zIndex: 99,
  },
  LeftLv2: {
    left: 8,
    zIndex: 99,
  },
  icon: { paddingHorizontal: 1 },
}))
