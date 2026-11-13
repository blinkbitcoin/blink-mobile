import * as React from "react"
import { View } from "react-native"
import Animated from "react-native-reanimated"
import Svg, { Line } from "react-native-svg"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useDashedLineFlow } from "@app/components/animations"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useCardApplicationApproval } from "./use-card-application-approval"

const PROGRESS_ICON_SIZE = 32
const DASHED_LINE_WIDTH = 89
/** Nine dashes across the line, with gaps as long as the dashes. */
const DASH_LENGTH = DASHED_LINE_WIDTH / 18

const AnimatedLine = Animated.createAnimatedComponent(Line)

type ProgressIconProps = {
  name: IconNamesType
  color: string
}

const ProgressIcon: React.FC<ProgressIconProps> = ({ name, color }) => {
  const styles = useStyles()

  return (
    <View style={styles.progressIcon}>
      <GaloyIcon name={name} size={PROGRESS_ICON_SIZE} color={color} />
    </View>
  )
}

export const CardProcessingScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
    params: { applicationId },
  } = useRoute<RouteProp<RootStackParamList, "cardOnboardingProcessingScreen">>()

  const approvalWait = useCardApplicationApproval(applicationId)
  /** The dashes flow toward the card for as long as the issuer is deciding. */
  const { animatedProps: flowingDashProps, dashArray } = useDashedLineFlow({
    dashLength: DASH_LENGTH,
    gapLength: DASH_LENGTH,
  })

  React.useEffect(() => {
    if (approvalWait === "approved") {
      navigation.replace("cardOnboardingPreapprovedScreen")
      return
    }
    /** A refusal, or a minute without an answer, leaves it to the home and a bulletin. */
    if (approvalWait !== "waiting") navigation.popTo("Primary")
  }, [approvalWait, navigation])

  return (
    <Screen preset="fixed">
      <View style={styles.content}>
        <View style={styles.progress}>
          <ProgressIcon name="clock" color={colors.success} />
          <Svg width={DASHED_LINE_WIDTH} height={1}>
            <AnimatedLine
              x1={0}
              y1={0.5}
              x2={DASHED_LINE_WIDTH}
              y2={0.5}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray={dashArray}
              animatedProps={flowingDashProps}
            />
          </Svg>
          <ProgressIcon name="card" color={colors.textOnBackground} />
        </View>
        <View style={styles.texts}>
          <Text type="h2" bold style={styles.centered}>
            {LL.CardFlow.Onboarding.CardProcessing.title()}
          </Text>
          <Text type="p3" style={styles.subtitle}>
            {LL.CardFlow.Onboarding.CardProcessing.subtitle()}
          </Text>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
  },
  progressIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceInteractive,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    alignItems: "center",
    gap: 8,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: "center",
  },
}))
