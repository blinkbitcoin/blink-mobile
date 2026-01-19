import { View, TouchableOpacity } from "react-native"

import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Icon, Text, makeStyles } from "@rn-vui/themed"

import { Delete } from "./delete"
import { LogOut } from "./logout"
import { useState } from "react"

export const DangerZoneSettings: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const [expanded, setExpanded] = useState(false)
  const defaultIcon = expanded ? "chevron-down" : "chevron-forward"

  const { currentLevel, isAtLeastLevelOne, isAtLeastLevelZero } = useLevel()
  if (!isAtLeastLevelZero) return <></>

  return (
    <View style={styles.verticalSpacing}>
      <TouchableOpacity style={styles.titleStyle} onPress={() => setExpanded(!expanded)}>
        <Icon name={defaultIcon} type="ionicon" size={20} />
        <Text type="p2" bold>
          {LL.AccountScreen.dangerZone()}
        </Text>
      </TouchableOpacity>
      {isAtLeastLevelOne && expanded && <LogOut />}
      {currentLevel !== AccountLevel.NonAuth && expanded && <Delete />}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  verticalSpacing: {
    marginTop: 5,
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
  },
  titleStyle: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
}))
