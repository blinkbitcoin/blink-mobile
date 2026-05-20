import React from "react"
import { TouchableOpacity, View } from "react-native"

import { ListItem, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import type { CloudBackupEntry } from "./hooks/use-cloud-restore"

type Props = {
  entries: ReadonlyArray<CloudBackupEntry>
  onSelect: (entry: CloudBackupEntry) => void
}

export const CloudBackupPicker: React.FC<Props> = ({ entries, onSelect }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <View>
      {entries.map((entry, index) => {
        const { walletIdentifier, lightningAddress, createdAt } = entry.metadata
        const hasLightningAddress = Boolean(lightningAddress)
        const dateLabel = `${LL.common.date()}: ${new Date(createdAt).toLocaleDateString()}`

        return (
          <TouchableOpacity
            key={entry.fileId}
            onPress={() => onSelect(entry)}
            {...testProps(`cloud-backup-entry-${entry.fileId}`)}
          >
            <ListItem
              bottomDivider
              containerStyle={[styles.listStyle, index === 0 && styles.firstItem]}
            >
              <GaloyIcon name="key-outline" size={20} color={colors.grey1} />
              <ListItem.Content>
                <ListItem.Title numberOfLines={1} ellipsizeMode="middle">
                  {hasLightningAddress ? lightningAddress : walletIdentifier}
                </ListItem.Title>
                {hasLightningAddress && (
                  <Text
                    type="p3"
                    style={styles.subtitle}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {walletIdentifier}
                  </Text>
                )}
                {createdAt > 0 && (
                  <Text type="p3" style={styles.subtitle} numberOfLines={1}>
                    {dateLabel}
                  </Text>
                )}
              </ListItem.Content>
            </ListItem>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listStyle: {
    borderBottomWidth: 2,
    borderColor: colors.grey5,
    backgroundColor: colors.white,
  },
  firstItem: {
    borderTopWidth: 2,
    borderColor: colors.grey5,
  },
  subtitle: {
    color: colors.grey2,
  },
}))
