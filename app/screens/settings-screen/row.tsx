import React, { useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, Skeleton, useTheme } from "@rn-vui/themed"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type Props = {
  title: string
  subtitle?: string
  subtitleShorter?: boolean
  leftGaloyIcon?: IconNamesType | React.ReactElement
  rightIcon?: IconNamesType | null | React.ReactElement
  extraComponentBesideTitle?: React.ReactElement
  action: (() => void | Promise<void>) | null
  rightIconAction?: () => void | Promise<void>
  loading?: boolean
  spinner?: boolean
  expanded?: boolean
}

export const SettingsRow: React.FC<Props> = ({
  title,
  subtitle,
  subtitleShorter,
  leftGaloyIcon,
  rightIcon = "",
  action,
  rightIconAction = action,
  extraComponentBesideTitle = <></>,
  loading,
  spinner,
  expanded = false,
}) => {
  const [hovering, setHovering] = useState(false)
  const styles = useStyles({ hovering })
  const {
    theme: { colors },
  } = useTheme()

  if (loading) return <Skeleton style={styles.container} animation="pulse" />
  if (spinner)
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
      </View>
    )

  const defaultIcon: IconNamesType = expanded ? "caret-down" : "caret-right"
  const hasLeftIcon = Boolean(leftGaloyIcon)
  const LeftIcon = hasLeftIcon && leftGaloyIcon && (
    typeof leftGaloyIcon === "string"
      ? <GaloyIcon name={leftGaloyIcon as IconNamesType} size={20} />
      : leftGaloyIcon
  )
  const RightIcon =
    rightIcon !== null &&
    (typeof rightIcon === "string" ? (
      <GaloyIcon
        name={(rightIcon as IconNamesType) || defaultIcon}
        size={20}
        color={colors.primary}
      />
    ) : (
      rightIcon
    ))

  return (
    <Pressable
      onPressIn={action ? () => setHovering(true) : () => {}}
      onPressOut={action ? () => setHovering(false) : () => {}}
      onPress={action ? action : undefined}
      {...testProps(title)}
    >
      <View style={[styles.container, styles.spacing]}>
        <View style={[styles.container, styles.spacing, styles.internalContainer]}>
          {LeftIcon}
          <View>
            <View style={styles.sidetoside}>
              <Text type="p2" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
                {title}
              </Text>
              <Text>{extraComponentBesideTitle}</Text>
            </View>
            {subtitle && (
              <Text
                type={subtitleShorter ? "p4" : "p3"}
                ellipsizeMode="tail"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={rightIconAction ? rightIconAction : undefined}
          {...testProps(title + "-right")}
        >
          <View style={styles.rightActionTouchArea}>{RightIcon}</View>
        </Pressable>
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }, { hovering }: { hovering: boolean }) => ({
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    backgroundColor: hovering ? colors.grey4 : undefined,
    minHeight: 58,
  },
  spacing: {
    paddingHorizontal: 8,
    paddingRight: 0,
  },
  center: {
    justifyContent: "space-around",
  },
  rightActionTouchArea: {
    paddingVertical: 17,
    paddingLeft: 14,
    paddingRight: 10,
    position: "relative",
  },
  sidetoside: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
  },
  internalContainer: {
    flex: 1,
    justifyContent: "flex-start",
    paddingRight: 18,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
  },
}))
