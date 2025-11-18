import React, { useState, useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { ListItem, Icon, makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { SettingsRow } from "@app/screens/settings-screen/row"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { Profile } from "./profile"
import { fetchProfiles } from "./utils"

export const SwitchAccount: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    appConfig: { token: currentToken },
  } = useAppConfig()
  const { saveProfile } = useSaveSessionProfile()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [profiles, setProfiles] = useState<ProfileProps[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return

    const loadProfiles = async () => {
      let profilesList = await fetchProfiles(currentToken)
      if (profilesList.length === 0) {
        await saveProfile(currentToken)
        profilesList = await fetchProfiles(currentToken)
      }
      setProfiles(profilesList)
    }

    loadProfiles()
  }, [expanded, saveProfile, currentToken, LL])

  const handleAddNew = () => {
    navigation.navigate("getStarted")
  }

  return (
    <>
      <SettingsRow
        title={/*LL.AccountScreen.switchAccount()*/ "Switch account"}
        leftGaloyIcon="refresh"
        action={() => setExpanded(!expanded)}
        expanded={expanded}
      />

      {expanded && (
        <>
          {profiles.map((profile, index) => (
            <Profile key={index} {...profile} />
          ))}
          <ListItem bottomDivider onPress={handleAddNew} containerStyle={styles.listItem}>
            <Icon name="add" size={25} type="ionicon" />
            <ListItem.Content>
              <ListItem.Title>{LL.ProfileScreen.addAccount()}</ListItem.Title>
            </ListItem.Content>
          </ListItem>
        </>
      )}
    </>
  )
}

export const useStyles = makeStyles(({ colors }) => ({
  listItem: {
    backgroundColor: colors.grey4,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey3,
  },
  loadingIcon: {
    margin: 15,
  },
  loadingIconColor: {
    color: colors.primary,
  },
}))
