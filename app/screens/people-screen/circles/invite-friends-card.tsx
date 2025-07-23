import { useState } from "react"
import { Alert, Share, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { InviteModal } from "@app/components/invite-modal"
import { PressableCard } from "@app/components/pressable-card"
import { getInviteLink } from "@app/config/appinfo"
import { useInviteQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, Text } from "@rn-vui/themed"

gql`
  query invite {
    me {
      id
      username
    }
  }
`

export const InviteFriendsCard = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false)

  const { data } = useInviteQuery()

  const share = async () => {
    try {
      const result = await Share.share({ message: getInviteLink(data?.me?.username) })

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.message)
      }
    }
  }

  const openInviteModal = () => setIsInviteModalVisible(true)

  return (
    <PressableCard onPress={openInviteModal}>
      <View style={styles.container}>
        <InviteModal
          isVisible={isInviteModalVisible}
          setIsVisible={setIsInviteModalVisible}
        />
        <Text type="p1">{LL.Circles.inviteFriends()}</Text>
        <View style={styles.iconContainer}>
          <GaloyIconButton name="share" size="medium" iconOnly onPress={share} />
          <GaloyIconButton
            name="qr-code"
            size="medium"
            iconOnly
            onPress={openInviteModal}
          />
        </View>
      </View>
    </PressableCard>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    display: "flex",
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 12,
    padding: 12,
    columnGap: 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconContainer: {
    display: "flex",
    flexDirection: "row",
    columnGap: 10,
  },
}))
