import { forwardRef, useImperativeHandle } from "react"
import { View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { useCountUp } from "use-count-up"

import { testProps } from "@app/utils/testProps"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type CircleProps = {
  heading: string
  value: number
  minValue?: number
  maxValue?: number
  description: string
  subtitle: string
  subtitleGreen?: boolean
  extraSubtitleLine?: string
  bubble?: boolean
  helpBtnModal?: React.ReactElement
  helpBtnModalEnable?: () => void
  countUpDuration?: number
}

export type CircleRef = {
  reset: () => void
}

// eslint-disable-next-line react/display-name
export const Circle = forwardRef<CircleRef, CircleProps>(
  (
    {
      heading,
      value,
      description,
      subtitle,
      subtitleGreen = false,
      extraSubtitleLine,
      bubble = false,
      minValue,
      maxValue,
      helpBtnModal,
      helpBtnModalEnable,
      countUpDuration = 0,
    },
    ref,
  ) => {
    const {
      theme: { colors },
    } = useTheme()
    const styles = useStyles({
      subtitleGreen,
    })

    const easedCountUpDuration = getcBackValue(
      countUpDuration,
      minValue,
      maxValue,
      0.5 * countUpDuration,
      countUpDuration,
    )

    const { value: countUpValue, reset } = useCountUp({
      isCounting: true,
      end: value,
      duration: easedCountUpDuration,
    })

    useImperativeHandle(
      ref,
      () => ({
        reset,
      }),
      [reset],
    )

    const cBackValue = getcBackValue(Number(countUpValue), minValue, maxValue)

    const cBackStyles = {
      height: cBackValue,
      width: cBackValue,
      borderRadius: cBackValue / 2,
      marginLeft: -cBackValue / 2,
      marginTop: -cBackValue / 2,
    }

    return (
      <View style={styles.circleContainer}>
        <View style={styles.circleHeading}>
          <Text type="p1">{heading}</Text>
          {helpBtnModal && (
            <View style={styles.helpBtn}>
              {helpBtnModal}
              <Icon
                color={colors.primary}
                name="help-circle-outline"
                size={23}
                onPress={helpBtnModalEnable}
              />
            </View>
          )}
        </View>
        <View style={styles.circleValueWrapper}>
          <View>
            <Text {...testProps(`${heading}-value`)} style={styles.circleValue}>
              {countUpValue}
            </Text>
            {bubble && <View style={[styles.circleBubble, cBackStyles]} />}
          </View>
          <Text style={styles.circleDescription}>{description}</Text>
        </View>
        {subtitle && <Text style={styles.circleSubtitle}>{subtitle}</Text>}
        {extraSubtitleLine && (
          <Text style={styles.circleSubtitleExtra}>{extraSubtitleLine}</Text>
        )}
      </View>
    )
  },
)

const useStyles = makeStyles(
  ({ colors }, { subtitleGreen }: { subtitleGreen?: boolean }) => {
    return {
      circleContainer: {
        marginLeft: "10%",
      },
      circleHeading: {
        marginBottom: 8,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        columnGap: 8,
      },
      circleValueWrapper: {
        display: "flex",
        flexDirection: "row",
        columnGap: 10,
        justifyContent: "flex-start",
        alignItems: "center",
        marginBottom: 4,
        position: "relative",
        width: "100%",
        paddingTop: 4,
        zIndex: -1,
      },
      circleValue: {
        fontWeight: "700",
        fontSize: 48,
        minWidth: 60,
        textAlign: "center",
        height: 60,
      },
      circleDescription: {
        maxWidth: "35%",
        marginBottom: 6,
        lineHeight: 20,
      },
      helpBtn: {
        alignSelf: "center",
      },
      circleSubtitle: {
        textAlign: "left",
        backgroundColor: subtitleGreen ? colors._green : colors.black,
        borderRadius: 10,
        paddingHorizontal: 10,
        alignSelf: "flex-start",
      },
      circleSubtitleExtra: { color: colors.black, marginTop: 4 },
      circleBubble: {
        position: "absolute",
        backgroundColor: colors.backdropWhiter,
        top: "50%",
        left: "50%",
      },
      loaderContainer: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "flex-end",
        height: 45,
        marginTop: 5,
      },
      loaderBackground: {
        color: colors.loaderBackground,
      },
      loaderForefound: {
        color: colors.loaderForeground,
      },
    }
  },
)

// ---------- HELPERS ----------
const easeOut = (x: number, minValue: number, maxValue: number) => {
  // Normalize x to 0-1 scale
  const xNorm = (x - minValue) / (maxValue - minValue)

  // ease-out formula
  return (-(xNorm - 1)) ** 4 + 1
}

export const getcBackValue = (
  circleValue?: number,
  circleMinValue?: number,
  circleMaxValue?: number,
  circleMinSizePx = 50,
  circleMaxSizePx = 1000,
  // eslint-disable-next-line max-params
) => {
  let cBackValue = 0

  if (
    typeof circleValue !== "undefined" &&
    typeof circleMinValue !== "undefined" &&
    typeof circleMaxValue !== "undefined"
  ) {
    let mappedValue
    if (circleMinValue <= circleValue && circleValue <= circleMaxValue)
      mappedValue = easeOut(circleValue, circleMinValue, circleMaxValue) * circleValue
    else if (circleMinValue > circleValue) mappedValue = circleMinValue
    else mappedValue = circleMaxValue

    cBackValue =
      circleMinSizePx +
      ((mappedValue - circleMinValue) / (circleMaxValue - circleMinValue)) *
        (circleMaxSizePx - circleMinSizePx)
  }
  return cBackValue
}
