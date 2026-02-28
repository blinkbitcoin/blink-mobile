import { forwardRef, useMemo, useRef } from "react"
import { View, Share as NativeShare } from "react-native"
import { LinearGradient } from "react-native-linear-gradient"
import Share from "react-native-share"
import { captureRef } from "react-native-view-shot"

import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg"
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg"
import { Circle } from "@app/components/circle"
import { getInviteLink } from "@app/config/appinfo"
import { useCirclesQuery, WelcomeProfile } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, Text, ThemeProvider, useTheme } from "@rn-vui/themed"

export const useCirclesCard = () => {
  const shareImgRef = useRef<View | null>(null)
  const { LL } = useI18nContext()

  const { data } = useCirclesQuery()

  const username = data?.me?.username || ""
  const welcomeProfile = data?.me?.defaultAccount.welcomeProfile

  const ShareImg = useMemo(() => {
    if (welcomeProfile)
      return (
        <ThemeProvider
          theme={{
            ...theme,
            mode: "dark",
          }}
        >
          <ShareImageComponent
            ref={shareImgRef}
            username={username}
            welcomeProfile={welcomeProfile}
          />
        </ThemeProvider>
      )
    return <></>
  }, [username, welcomeProfile])

  const share = async () => {
    try {
      if (!welcomeProfile || welcomeProfile?.innerCircleAllTimeCount === 0) {
        const inviteLink = getInviteLink(data?.me?.username)
        await NativeShare.share({ message: inviteLink })
        return
      }

      if (!shareImgRef.current) return

      const uri = await captureRef(shareImgRef.current, {
        format: "jpg",
        quality: 1.0,
      })

      const shareName = `${LL.Circles.someones({
        username,
      })} ${LL.Circles.titleBlinkCircles()}`

      const shareOptions = {
        fileName: shareName,
        title: shareName,
        url: uri,
        type: "image/jpeg",
        message: `${LL.Circles.drivingAdoption()} #blinkcircles @blinkbtc`,
      }

      await Share.open(shareOptions)
    } catch (error) {
      crashlytics().log("User didn't share")
    }
  }

  return { ShareImg, share }
}

type ShareImageProps = {
  username: string
  welcomeProfile: WelcomeProfile
}
const ShareImageComponent: React.FC<ShareImageProps & React.RefAttributes<View>> =
  // eslint-disable-next-line react/display-name
  forwardRef(({ username, welcomeProfile }, ref) => {
    const styles = useStyles()
    const {
      theme: { colors, mode },
    } = useTheme()
    const { LL } = useI18nContext()

    const appConfig = useAppConfig().appConfig
    const lnAddressHostname = appConfig.galoyInstance.lnAddressHostname
    const lnAddress = `${username}@${lnAddressHostname}`

    const Logo = mode === "dark" ? LogoDarkMode : LogoLightMode

    return (
      <View ref={ref} style={styles.shareContainer}>
        <Logo style={styles.logo} height={60} />
        <View style={styles.usernameContainer}>
          <LinearGradient
            style={styles.usernameContainerGrad}
            colors={[colors._primary2, colors._primary1]}
            useAngle={true}
            angle={190}
            angleCenter={{ x: 0.5, y: 0.5 }}
          >
            <Text type="h1" style={styles.boldText} color={colors.white}>
              {LL.Circles.myBlinkCircles()}
            </Text>
            <Text type="p2" color={colors.white}>
              {lnAddress}
            </Text>
          </LinearGradient>
        </View>
        <Text type="p2" style={styles.description}>
          {LL.Circles.innerCircleExplainerCard()}
        </Text>
        <Circle
          heading={LL.Circles.innerCircle()}
          value={welcomeProfile.innerCircleAllTimeCount}
          minValue={1}
          maxValue={180}
          description={LL.Circles.peopleIWelcomed()}
          subtitle={
            welcomeProfile.innerCircleThisMonthCount > 0
              ? `+ ${welcomeProfile.innerCircleThisMonthCount} ${LL.Circles.thisMonth()}`
              : ""
          }
          subtitleGreen
          bubble
          countUpDuration={0}
        />
        <Circle
          heading={LL.Circles.outerCircle()}
          value={welcomeProfile.outerCircleAllTimeCount}
          minValue={1}
          maxValue={180}
          description={LL.Circles.peopleWelcomedByMyCircle()}
          subtitle={
            welcomeProfile.outerCircleThisMonthCount > 0
              ? `+ ${welcomeProfile.outerCircleThisMonthCount} ${LL.Circles.thisMonth()}`
              : ""
          }
          subtitleGreen
          bubble
          countUpDuration={0}
        />
        <Text style={styles.rankText} type="p3" bold>
          {LL.Circles.rankMessage({
            thisMonthRank: welcomeProfile.thisMonthRank,
            allTimeRank: welcomeProfile.allTimeRank,
          })}
        </Text>
        <View style={styles.buildUrCircle}>
          <Text type="p2">{LL.Circles.buildYourCircle()} </Text>
          <Text type="p1" style={styles.boldText} color={colors.primary}>
            get.blink.sv
          </Text>
        </View>
      </View>
    )
  })

const useStyles = makeStyles(({ colors }) => ({
  shareContainer: {
    top: -10000,
    left: -10000,

    // Enable these and disable top two to debug view
    // top: 0,
    // left: "10%",
    // borderWidth: 1,
    // borderColor: colors.red,
    // zIndex: 5,
    // transform: [
    //   {
    //     scale: 0.8,
    //   },
    // ],

    height: 480,
    width: (480 * 3) / 4,
    backgroundColor: colors._black,
    position: "absolute",

    display: "flex",
    flexDirection: "column",
    rowGap: 18,
    justifyContent: "center",

    paddingTop: 100,
    overflow: "hidden",
  },
  buildUrCircle: {
    marginTop: 10,
    paddingHorizontal: 40,
  },
  logo: {
    position: "absolute",
    padding: 80,
    right: 0,
    bottom: -35,
  },
  usernameContainer: {
    position: "absolute",
    minWidth: "80%",
    top: 0,
    // left: -12,
    zIndex: 20,
  },
  usernameContainerGrad: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderBottomRightRadius: 40,
  },
  description: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 120,
    textAlign: "left",
    color: colors.grey3,
  },
  boldText: { fontWeight: "700" },
  rankText: {
    paddingHorizontal: 40,
  },
}))
