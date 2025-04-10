import React, { useState, useEffect, useRef } from "react"
import { Button, ActivityIndicator } from "react-native"
import {
  ListItem,
  makeStyles,
  Icon,
  Avatar,
  Text,
  useTheme,
  Overlay,
} from "@rneui/themed"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { SettingsRow } from "../row"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import {
  GetUsernamesQuery,
  useUserLogoutMutation,
  useGetUsernamesLazyQuery,
} from "@app/graphql/generated"
import { useApolloClient, gql } from "@apollo/client"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { logLogout } from "@app/utils/analytics"
import crashlytics from "@react-native-firebase/crashlytics"

gql`
  query getUsernames {
    me {
      id
      phone
      username
    }
  }
`

type ProfileProps = {
  userid?: string | null
  identifier: string
  token: string
  selected?: boolean
  avatarurl?: string
}

export const SwitchAccount: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { persistentState } = usePersistentStateContext()
  const { galoyAuthToken: currentToken } = persistentState

  const [fetchUsername, { error, refetch }] = useGetUsernamesLazyQuery({
    fetchPolicy: "no-cache",
  })
  const [profiles, setProfiles] = useState<ProfileProps[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<boolean>(true)

  const prevTokenRef = useRef<string>(persistentState.galoyAuthToken)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      if (!expanded) return
      setProfiles([])
      const profiles: ProfileProps[] = []
      let sessionTokens = (await KeyStoreWrapper.getSessionTokens()).reverse()
      let counter = 1

      // Add session token if not exist
      if (sessionTokens.length <= 0 && currentToken) {
        await KeyStoreWrapper.saveSessionToken(currentToken)
        sessionTokens = [currentToken]
      }

      for (const token of sessionTokens) {
        try {
          const { data } = await fetchUsername({
            context: { headers: { authorization: `Bearer ${token}` } },
          })

          const existingProfileIndex = findExistingProfileIndex(profiles, data)
          if (data?.me && existingProfileIndex === -1) {
            profiles.push({
              userid: data.me?.id,
              identifier: data.me?.username || data.me?.phone || `Blink User ${counter}`,
              token,
              selected: token === currentToken,
            })

            counter = counter + 1
          }

          if (existingProfileIndex !== -1) {
            // Avoid duplicate account data and clear store
            await KeyStoreWrapper.removeTokenFromSession(token)
          }

          if (!data?.me) {
            // Remove invalid token
            await KeyStoreWrapper.removeTokenFromSession(token)
          }
        } catch (err) {
          console.error(`Failed to fetch username for token ${token}`, err)
        }
      }
      setProfiles(profiles)
      setLoading(false)
    })()
  }, [expanded, currentToken, fetchUsername])

  const findExistingProfileIndex = (
    profiles: ProfileProps[],
    userData?: GetUsernamesQuery,
  ) => {
    return profiles.findIndex(
      (profile) =>
        profile.identifier === userData?.me?.username ||
        profile.identifier === userData?.me?.phone,
    )
  }

  useEffect(() => {
    if (prevTokenRef.current !== persistentState.galoyAuthToken) {
      // Navigate to home when token is updated and different from the previous token
      navigation.navigate("Primary")
    }
    prevTokenRef.current = persistentState.galoyAuthToken // Update previous token
  }, [persistentState.galoyAuthToken, navigation])

  const handleAddNew = () => {
    navigation.navigate("getStarted")
  }

  return (
    <>
      <SettingsRow
        title={LL.AccountScreen.switchAccount()}
        leftIcon="people"
        action={() => setExpanded(!expanded)}
        expanded={expanded}
      />

      {expanded &&
        (loading ? (
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            style={styles.loadingIcon}
            color={styles.loadingIconColor.color}
          />
        ) : error ? (
          <>
            <Text adjustsFontSizeToFit style={styles.errorText}>
              {LL.ProfileScreen.error()}
            </Text>
            <Button
              title="reload"
              disabled={loading}
              color={colors.error}
              onPress={() => refetch()}
            />
          </>
        ) : (
          <>
            {profiles.map((profile, index) => {
              return <Profile key={index} {...profile} />
            })}

            <ListItem
              bottomDivider
              onPress={handleAddNew}
              containerStyle={styles.listItem}
            >
              <Icon name="add" size={25} type="ionicon" />
              <ListItem.Content>
                <ListItem.Title>{LL.ProfileScreen.addAccount()}</ListItem.Title>
              </ListItem.Content>
            </ListItem>
          </>
        ))}
    </>
  )
}

const Profile: React.FC<ProfileProps> = ({ identifier, token, selected, avatarurl }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const [logoutLoading, setLogoutLoading] = useState<boolean>(false)
  const [switchLoading, setSwitchLoading] = useState<boolean>(false)
  const { updateState } = usePersistentStateContext()
  const client = useApolloClient()
  const [userLogoutMutation] = useUserLogoutMutation({
    fetchPolicy: "no-cache",
  })

  const handleLogout = async () => {
    setLogoutLoading(true)
    await logOut(token)

    // Remove token
    await KeyStoreWrapper.removeTokenFromSession(token)
    navigation.navigate("Primary")
    setLogoutLoading(false)
  }
  const logOut = async (deviceToken: string) => {
    try {
      logLogout()
      await Promise.race([
        userLogoutMutation({
          variables: { input: { deviceToken } },
          context: { headers: { authorization: `Bearer ${token}` } },
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Logout mutation timeout"))
          }, 2000)
        }),
      ])
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        console.debug({ err }, `error logout`)
      }
    }
  }

  const handleProfileSwitch = () => {
    setSwitchLoading(true)
    updateState((state) => {
      if (state) {
        return {
          ...state,
          galoyAuthToken: token,
        }
      }
      return state
    })
    client.clearStore() // clear cache to load fresh data using new token
    setSwitchLoading(false)
  }

  return (
    <>
      <ListItem
        bottomDivider
        onPress={handleProfileSwitch}
        containerStyle={styles.listItem}
        style={selected && styles.listItemSelected}
      >
        {avatarurl ? (
          <Avatar rounded source={{ uri: avatarurl }} size={44} />
        ) : (
          <GaloyIcon name="user" size={30} backgroundColor={styles.iconColor.color} />
        )}
        <ListItem.Content>
          <ListItem.Title>{identifier}</ListItem.Title>
        </ListItem.Content>

        {selected === false ? (
          <>
            {logoutLoading ? (
              <ActivityIndicator size="large" color={styles.loadingIconColor.color} />
            ) : (
              <GaloyIconButton
                name="close"
                size="medium"
                onPress={handleLogout}
                backgroundColor={styles.iconColor.color}
              />
            )}
          </>
        ) : null}
      </ListItem>
      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={styles.loadingIconColor.color} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listItem: {
    backgroundColor: colors.grey4,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey3,
  },
  listItemSelected: {
    borderLeftWidth: 5,
    borderLeftColor: colors.primary,
  },
  iconColor: {
    color: colors.grey5,
  },
  errorWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: "50%",
    marginBottom: "50%",
  },
  errorText: {
    color: colors.error,
    fontWeight: "bold",
    fontSize: 15,
    margin: 12,
    textAlign: "center",
  },
  loadingIcon: {
    margin: 15,
  },
  loadingIconColor: {
    color: colors.primary,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
