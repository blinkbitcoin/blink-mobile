import React, { useCallback, useState } from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

const DOWNLOADED_OPACITY = 0.4

type StatementItemProps = {
  title: string
  subtitle1?: string
  subtitle2?: string
  onDownload: () => void
  isDownloaded?: boolean
}

export const StatementItem: React.FC<StatementItemProps> = ({
  title,
  subtitle1,
  subtitle2,
  onDownload,
  isDownloaded: initialDownloaded = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [isDownloaded, setIsDownloaded] = useState(initialDownloaded)

  const handleDownload = useCallback(() => {
    onDownload()
    setIsDownloaded(true)
  }, [onDownload])

  return (
    <View style={styles.container}>
      <GaloyIcon name="document-outline" size={20} color={colors.black} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle1 && <Text style={styles.subtitle1}>{subtitle1}</Text>}
        {subtitle2 && <Text style={styles.subtitle2}>{subtitle2}</Text>}
      </View>
      <TouchableOpacity
        testID="statement-download-button"
        style={styles.downloadButton}
        onPress={handleDownload}
      >
        <GaloyIcon
          name="download"
          size={20}
          color={colors.primary}
          opacity={isDownloaded ? DOWNLOADED_OPACITY : 1}
        />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 14,
    minHeight: 81,
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 22,
  },
  subtitle1: {
    color: colors.grey2,
    fontSize: 12,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 18,
  },
  subtitle2: {
    color: colors.grey2,
    fontSize: 10,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 13,
  },
  downloadButton: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginVertical: -10,
    marginRight: -10,
  },
}))
