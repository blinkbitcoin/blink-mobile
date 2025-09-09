import * as React from "react"
import {
  Alert,
  Platform,
  Share,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native"
import Modal from "react-native-modal"
import QRCode from "react-native-qrcode-svg"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import Logo from "@app/assets/logo/blink-logo-icon.png"
import { getInviteLink } from "@app/config/appinfo"
import { useInviteQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PeopleStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme, Text } from "@rneui/themed"

import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { GaloyToast } from "../galoy-toast"
import { PressableCard } from "../pressable-card"

type Props = {
  isVisible: boolean
  setIsVisible: (isVisible: boolean) => void
}

gql`
  query invite {
    me {
      id
      username
    }
  }
`

export const InviteModal: React.FC<Props> = ({ isVisible, setIsVisible }) => {
  const { LL } = useI18nContext()

  const { data } = useInviteQuery()

  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const navigation = useNavigation<StackNavigationProp<PeopleStackParamList>>()

  const acknowledgeModal = () => {
    setIsVisible(false)
  }

  const { scale } = useWindowDimensions()
  const getQrSize = () => {
    if (Platform.OS === "android") {
      if (scale > 3) {
        return 195
      }
    }
    return 280
  }

  const inviteLink = getInviteLink(data?.me?.username)

  const copyToClipboard = () => {
    Clipboard.setString(inviteLink)
    toastShow({
      type: "success",
      message: LL.Circles.copiedInviteLink(),
      LL,
    })
  }

  const share = async () => {
    try {
      const result = await Share.share({ message: inviteLink })

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

  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      backdropTransitionOutTiming={0}
      onBackdropPress={acknowledgeModal}
    >
      <View style={styles.modalCard}>
        <View style={styles.container}>
          <View style={styles.cardTitleContainer}>
            <Text type="h1" bold>
              {LL.Circles.inviteFriendToBlink()}
            </Text>
            <View style={styles.cross}>
              <GaloyIconButton name="close" size="medium" onPress={acknowledgeModal} />
            </View>
          </View>
          <PressableCard onPress={copyToClipboard}>
            <View style={styles.qrCard}>
              <QRCode
                size={getQrSize()}
                value={inviteLink}
                logoBackgroundColor="white"
                ecl={"M"}
                logo={Logo}
                logoSize={60}
                logoBorderRadius={10}
              />
            </View>
          </PressableCard>

          <View style={styles.qrMetadata}>
            <Text type="p3">{inviteLink}</Text>
          </View>

          <View style={styles.actions}>
            <View style={styles.copyContainer}>
              <TouchableOpacity onPress={copyToClipboard}>
                <Text color={colors.grey2}>
                  <Icon color={colors.grey2} name="copy-outline" />
                  <Text> </Text>
                  {LL.PeopleScreen.copy()}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shareContainer}>
              <TouchableOpacity onPress={share}>
                <Text color={colors.grey2}>
                  <Icon color={colors.grey2} name="share-outline" />
                  <Text> </Text>
                  {LL.Circles.share()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardBodyContainer}>
            <Text type="p2" style={styles.textCenter}>
              {LL.Circles.circlesGrowingSatsExplainer.your()}{" "}
              <Text
                style={styles.underline}
                onPress={() => {
                  setIsVisible(false)
                  navigation.navigate("circlesDashboard")
                }}
              >
                {LL.Circles.titleBlinkCircles()}
              </Text>{" "}
              {LL.Circles.circlesGrowingSatsExplainer.grow()}
            </Text>
          </View>
        </View>
      </View>
      <GaloyToast />
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 12,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cross: {},
  qrCard: {
    backgroundColor: colors._white,
    padding: 20,
    borderRadius: 12,
  },
  modalCard: {
    backgroundColor: colors.grey5,
    borderRadius: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
  },
  cardTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    alignItems: "center",
    columnGap: 20,
  },
  cardBodyContainer: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  textCenter: {
    textAlign: "center",
  },
  qrMetadata: {
    marginTop: -10,
  },
  actions: {
    marginTop: -10,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  copyContainer: {
    flex: 2,
    marginLeft: 10,
  },
  shareContainer: {
    flex: 2,
    alignItems: "flex-end",
    marginRight: 10,
  },
  underline: {
    textDecorationLine: "underline",
  },
}))
