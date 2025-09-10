import { TouchableOpacity, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, useTheme } from "@rneui/themed"

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

  const {
    theme: { colors },
  } = useTheme()
  const getPositionStyle = (position: "topCenter" | "LeftLv1" | "LeftLv2") => {
    switch (position) {
      case "topCenter":
        return styles.topCenter
      case "LeftLv1":
        return styles.LeftLv1
      case "LeftLv2":
        return styles.LeftLv2
      default:
        return {}
    }
  }
  return (
    <View style={{ ...styles.container, ...getPositionStyle(position) }}>
      <TouchableOpacity onPress={event}>
        {iconName ? (
          <Icon
            color={colors.primary}
            name={iconName}
            size={22}
            style={{ paddingHorizontal: 1 }}
          />
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
    top: 18,
  },
  LeftLv1: {
    top: 18,
    left: 8,
    zIndex: 99,
  },
  LeftLv2: {
    top: 66,
    left: 8,
    zIndex: 99,
  },
}))
