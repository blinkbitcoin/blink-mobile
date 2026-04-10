import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

type BackupNudgeBannerProps = {
  onDismiss: () => void
}

export const BackupNudgeBanner: React.FC<BackupNudgeBannerProps> = ({ onDismiss }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <View style={styles.container} {...testProps("backup-nudge-banner")}>
      <View style={styles.content}>
        <GaloyIcon name="warning" size={20} color={colors.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{LL.BackupNudge.title()}</Text>
          <Text style={styles.description}>{LL.BackupNudge.description()}</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={16}
          {...testProps("backup-nudge-dismiss")}
        >
          <GaloyIcon name="close" size={16} color={colors.grey2} />
        </Pressable>
      </View>
      <Pressable
        style={styles.ctaButton}
        onPress={() => navigation.navigate("sparkBackupMethodScreen")}
        {...testProps("backup-nudge-cta")}
      >
        <Text style={styles.ctaText}>{LL.BackupNudge.cta()}</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.black,
  },
  description: {
    fontSize: 12,
    color: colors.grey2,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
}))
