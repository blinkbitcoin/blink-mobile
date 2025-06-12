import { TouchableOpacity, View } from "react-native"

import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Icon, Text, makeStyles } from "@rneui/themed"

import { Delete } from "./delete"
import { useState } from "react"

export const DangerZoneSettings: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const { currentLevel, isAtLeastLevelZero } = useLevel()
  const [expanded, setExpanded] = useState(false)

  const defaultIcon = expanded ? "chevron-down" : "chevron-forward"
  if (!isAtLeastLevelZero) return <></>

  return (
    <View style={styles.verticalSpacing}>
      <TouchableOpacity style={styles.titleStyle} onPress={() => setExpanded(!expanded)}>
        <Icon name={defaultIcon} type="ionicon" size={20} />
        <Text type="p2" bold>
          {LL.AccountScreen.dangerZone()}
        </Text>
      </TouchableOpacity>
      {currentLevel !== AccountLevel.NonAuth && expanded && <Delete />}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  verticalSpacing: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },
  titleStyle: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
}))
