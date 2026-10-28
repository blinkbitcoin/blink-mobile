import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { testProps } from "@app/utils/testProps"

type BundleProgressViewProps = {
  icon: IconNamesType
  caption: string
  testID: string
}

/**
 * The two actionless states of the flow - checking, and checked.
 *
 * One component because they are one thing to the user: a status the app is
 * reporting, not a decision it is asking for. Giving either a button would
 * invite a tap on something already underway or already done.
 */
export const BundleProgressView: React.FC<BundleProgressViewProps> = ({
  icon,
  caption,
  testID,
}) => {
  const styles = useStyles()

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container} {...testProps(testID)}>
        {/* Full-colour assets: they carry their own tint. */}
        <GaloyIcon name={icon} size={100} />
        <Text type="p1" style={styles.caption}>
          {caption}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 20,
  },
  caption: {
    textAlign: "center",
  },
}))
