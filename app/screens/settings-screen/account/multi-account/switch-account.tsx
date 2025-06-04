import React, { useState, useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles } from "@rneui/themed"
import { Screen } from "@app/components/screen"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { ProfileScreen } from "./profile"
import { fetchProfiles } from "@app/utils/multi-account"
import { ScrollView } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

export const SwitchAccount: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    appConfig: { token: currentToken },
  } = useAppConfig()
  const { saveProfile } = useSaveSessionProfile()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [profiles, setProfiles] = useState<ProfileProps[]>([])

  useEffect(() => {
    const loadProfiles = async () => {
      let profilesList = await fetchProfiles(currentToken)
      if (profilesList.length === 0) {
        await saveProfile(currentToken)
        profilesList = await fetchProfiles(currentToken)
      }
      setProfiles(profilesList)
    }

    loadProfiles()
  }, [saveProfile, currentToken])

  const handleAddNew = () => {
    navigation.navigate("getStarted")
  }

  return (
    <Screen keyboardShouldPersistTaps="handled" style={styles.containerScreen}>
      <ScrollView contentContainerStyle={styles.outer}>
        {profiles.map((profile, index) => (
          <ProfileScreen key={index} {...profile} isFirstItem={index === 0} />
        ))}
      </ScrollView>
      <GaloyPrimaryButton
        style={styles.addAccountButton}
        onPress={handleAddNew}
        title={LL.ProfileScreen.addAccount()}
      />
    </Screen>
  )
}

export const useStyles = makeStyles(() => ({
  containerScreen: {
    paddingBottom: 40,
  },
  outer: {
    marginTop: 4,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    // rowGap: 2,
  },
  addAccountButton: {
    paddingHorizontal: 20,
  },
}))
