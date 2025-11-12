import React, { useState, useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles } from "@rn-vui/themed"
import { Screen } from "@app/components/screen"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { ProfileScreen } from "./profile"
import { fetchProfiles } from "@app/utils/multi-account"
import { ScrollView, View } from "react-native"
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
  const [nextProfileToken, setNextProfileToken] = useState<string>()

  useEffect(() => {
    if (!currentToken) return
    const loadProfiles = async () => {
      let profilesList = await fetchProfiles(currentToken)
      if (profilesList.length === 0) {
        await saveProfile(currentToken)
        profilesList = await fetchProfiles(currentToken)
      }
      setProfiles(profilesList)
      setNextProfileToken(profilesList.find((profile) => !profile.selected)?.token)
    }

    loadProfiles()
  }, [saveProfile, currentToken])

  const handleAddNew = () => {
    navigation.navigate("getStarted")
  }

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        {profiles.map((profile, index) => (
          <ProfileScreen
            key={index}
            {...profile}
            isFirstItem={index === 0}
            nextProfileToken={nextProfileToken}
          />
        ))}
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          onPress={handleAddNew}
          title={LL.ProfileScreen.addAccount()}
        />
      </View>
    </Screen>
  )
}

export const useStyles = makeStyles(() => ({
  outer: {
    marginTop: 4,
    paddingBottom: 20,
    flexDirection: "column",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    marginHorizontal: 20,
  },
}))
