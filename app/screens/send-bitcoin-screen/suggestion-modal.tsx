import * as React from "react"
import { View, TextInput } from "react-native"

import { gql } from "@apollo/client"
import { useFeedbackSubmitMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../../components/custom-modal/custom-modal"
import { testProps } from "../../utils/testProps"

gql`
  mutation feedbackSubmit($input: FeedbackSubmitInput!) {
    feedbackSubmit(input: $input) {
      errors {
        message
        __typename
      }
      success
      __typename
    }
  }
`

export const SuggestionModal: React.FC<{
  navigation: StackNavigationProp<RootStackParamList>
  showSuggestionModal: boolean
  setShowSuggestionModal: (value: boolean) => void
}> = ({ navigation, showSuggestionModal, setShowSuggestionModal }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const [suggestion, setSuggestion] = React.useState("")
  const [sendFeedback] = useFeedbackSubmitMutation()

  const submitSuggestion = async () => {
    await sendFeedback({ variables: { input: { feedback: suggestion } } })
    setShowSuggestionModal(false)
    navigation.popToTop()
  }

  const dismissSuggestionModal = () => {
    navigation.popToTop()
    setShowSuggestionModal(false)
  }

  return (
    <CustomModal
      title={LL.support.thankYouText()}
      minHeight={"50%"}
      titleMaxWidth={"100%"}
      titleTextAlignment={"left"}
      toggleModal={dismissSuggestionModal}
      isVisible={showSuggestionModal}
      primaryButtonTitle={LL.common.submit()}
      primaryButtonOnPress={submitSuggestion}
      primaryButtonDisabled={suggestion === ""}
      body={
        <View style={styles.field}>
          <TextInput
            {...testProps(LL.SendBitcoinScreen.suggestionInput())}
            style={styles.noteInput}
            onChangeText={(improvement: React.SetStateAction<string>) =>
              setSuggestion(improvement)
            }
            placeholder={LL.SendBitcoinScreen.suggestionInput()}
            placeholderTextColor={colors.grey2}
            value={suggestion}
            multiline={true}
            numberOfLines={3}
            autoFocus
          />
        </View>
      }
      secondaryButtonTitle={LL.AuthenticationScreen.skip()}
      secondaryButtonOnPress={dismissSuggestionModal}
      showCloseIconButton={false}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  noteInput: {
    color: colors.black,
  },
  field: {
    padding: 10,
    backgroundColor: colors.grey5,
    borderRadius: 10,
  },
}))
