import {
  StatefulNotification,
  StatefulNotificationsDocument,
  useStatefulNotificationAcknowledgeMutation,
} from "@app/graphql/generated"
import { Icon, Text, makeStyles, useTheme } from "@rneui/themed"
import { View, Linking } from "react-native"
import { timeAgo } from "./utils"
import { gql } from "@apollo/client"
import { TouchableWithoutFeedback } from "react-native-gesture-handler"
import { useState } from "react"
import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

gql`
  mutation StatefulNotificationAcknowledge(
    $input: StatefulNotificationAcknowledgeInput!
  ) {
    statefulNotificationAcknowledge(input: $input) {
      notification {
        acknowledgedAt
      }
    }
  }
`

export const Notification: React.FC<StatefulNotification> = ({
  id,
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

  const [ack, _] = useStatefulNotificationAcknowledgeMutation({
    variables: { input: { notificationId: id } },
    refetchQueries: [StatefulNotificationsDocument],
  })

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        setIsAcknowledged(true)
        !isAcknowledged && ack()
        if (action?.__typename === "OpenDeepLinkAction")
          Linking.openURL(BLINK_DEEP_LINK_PREFIX + action.deepLink)
        else if (action?.__typename === "OpenExternalLinkAction")
          Linking.openURL(action.url)
      }}
    >
      <View style={styles.container}>
        {icon ? (
          <GaloyIcon
            name={icon?.toLowerCase().replace("_", "-") as IconNamesType}
            color={isAcknowledged ? colors.grey3 : colors.black}
            size={26}
          />
        ) : (
          <Icon
            type="ionicon"
            name="notifications-outline"
            color={isAcknowledged ? colors.grey3 : colors.black}
            size={26}
          />
        )}
        <View>
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
    text: {
      color: isAcknowledged ? colors.grey3 : colors.black,
    },
  }),
)
