import React, { useEffect, useState } from "react"
import { StatefulNotification } from "@app/graphql/generated"
import { Icon, Text, makeStyles, useTheme } from "@rn-vui/themed"
import { View, Linking } from "react-native"
import { timeAgo, toGaloyIconName } from "./utils"
import { TouchableWithoutFeedback } from "react-native-gesture-handler"
import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"

export const Notification: React.FC<StatefulNotification> = ({
  title,
  body,
  createdAt,
  acknowledgedAt,
  icon,
  action,
}) => {
  const [isAcknowledged, setIsAcknowledged] = useState(Boolean(acknowledgedAt))
  const styles = useStyles({ isAcknowledged })
  const {
    theme: { colors },
  } = useTheme()

  useEffect(() => {
    if (acknowledgedAt && !isAcknowledged) {
      setIsAcknowledged(true)
    }
  }, [acknowledgedAt, isAcknowledged])

  const iconName = toGaloyIconName(icon)
  const iconColor = isAcknowledged ? colors.grey2 : colors.black

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        if (action?.__typename === "OpenDeepLinkAction")
          Linking.openURL(BLINK_DEEP_LINK_PREFIX + action.deepLink)
        else if (action?.__typename === "OpenExternalLinkAction")
          Linking.openURL(action.url)
      }}
    >
      <View style={styles.container}>
        {iconName ? (
          <GaloyIcon name={iconName} color={iconColor} size={26} />
        ) : (
          <Icon
            type="ionicon"
            name="notifications-outline"
            color={iconColor}
            size={26}
            testID="notification-default-icon"
          />
        )}
        <View style={styles.content} testID="notification-content">
          <Text type="p2" style={styles.text}>
            {title}
          </Text>
          <Text type="p3" style={styles.text}>
            {body}
          </Text>
          <Text type="p4" style={styles.text}>
            {timeAgo(createdAt)}
          </Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}

const useStyles = makeStyles(
  ({ colors }, { isAcknowledged }: { isAcknowledged: boolean }) => ({
    container: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.grey5,
      display: "flex",
      flexDirection: "row",
      columnGap: 12,
      alignItems: "center",
    },
    /**
     * Without flex: 1 the text column sizes to its content inside the row,
     * pushing long titles and bodies past the screen edge instead of wrapping.
     */
    content: {
      flex: 1,
    },
    text: {
      color: isAcknowledged ? colors.grey2 : colors.black,
    },
  }),
)
