import { gql, useMutation } from "@apollo/client"
import { translate } from "../../i18n"
import * as React from "react"
import { ListItem, Icon } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
// import Icon from "react-native-vector-icons/Ionicons"
import { Screen } from "../../components/screen"
import { palette } from "../../theme/palette"
import type { ScreenType } from "../../types/jsx"
import useToken from "../../utils/use-token"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  screenStyle: {
    marginHorizontal: 48,
  },
})

export const LanguageScreen: ScreenType = () => {
  const { tokenUid } = useToken()
  const { userPreferredLanguage, refetch: refetchMain } = useMainQuery()
  const [updateLanguage] = useMutation(
    gql`
      mutation updateLanguage($language: Language!) {
        userUpdateLanguage(input: { language: $language }) {
          errors {
            message
          }
          user {
            id
            language
          }
        }
      }
    `,
    {
      onCompleted: () => refetchMain(),
    },
  )

  const list = ["DEFAULT", "en-US", "es-SV"]

  return (
    <Screen preset="scroll" style={styles.screenStyle}>
      {list.map((language) => (
        <ListItem
          key={language}
          bottomDivider
          onPress={() => {
            if (language !== userPreferredLanguage) {
              updateLanguage({
                variables: { language },
                optimisticResponse: {
                  __typename: "Mutation",
                  userUpdateLanguage: {
                    __typename: "UserUpdateLanguagePayload",
                    errors: [],
                    user: {
                      __typename: "User",
                      id: tokenUid,
                      language,
                    },
                  },
                },
              })
            }
          }}
        >
          <ListItem.Title>{translate(`Languages.${language}`)}</ListItem.Title>
          {userPreferredLanguage === language && (
            <Icon name="checkmark-circle" size={18} color={palette.green} type="ionicon" />
          )}
        </ListItem>
      ))}
    </Screen>
  )
}
