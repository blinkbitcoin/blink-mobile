import React from "react"
import { View } from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, useTheme, Text, Divider } from "@rn-vui/themed"

export const SettingsGroup: React.FC<{
  name?: string
  items: React.FC[]
}> = ({ name, items }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const filteredItems = items.filter((x) => x({}) !== null)

  return (
    <View>
      {name && (
        <Text {...testProps(name + "-group")} type="p2" bold>
          {name}
        </Text>
      )}
      <View style={styles.groupCard}>
        {filteredItems.map((Element, index) => (
          <View key={index}>
            <Element />
            {index < filteredItems.length - 1 && (
              <Divider color={colors.grey4} style={styles.divider} />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  groupCard: {
    marginTop: 5,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: 10,
  },
}))
