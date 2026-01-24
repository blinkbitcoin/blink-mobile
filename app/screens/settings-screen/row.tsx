import React, { useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, Icon, Text, Skeleton, useTheme } from "@rn-vui/themed"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type Props = {
  title: string
  subtitle?: string
  subtitleShorter?: boolean
  leftIcon?: string
  leftGaloyIcon?: IconNamesType
  rightIcon?: string | null | React.ReactElement
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
  leftIcon,
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

  const defaultIcon = expanded ? "chevron-down" : "chevron-forward"
  const hasLeftIcon = Boolean(leftGaloyIcon || leftIcon)
  const RightIcon =
    rightIcon !== null &&
    (typeof rightIcon === "string" ? (
      <Icon
        name={rightIcon ? rightIcon : defaultIcon}
        type="ionicon"
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
          {hasLeftIcon &&
            (leftGaloyIcon ? (
              <GaloyIcon name={leftGaloyIcon} size={20} />
            ) : (
              <Icon name={leftIcon ?? ""} type="ionicon" size={20} />
            ))}
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
