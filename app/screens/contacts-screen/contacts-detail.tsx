import { useMutation, gql } from "@apollo/client"
import * as React from "react"
import { View } from "react-native"
import { Input, Text, Icon } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
// import Icon from "react-native-vector-icons/Ionicons"
import { CloseCross } from "../../components/close-cross"
import { IconTransaction } from "../../components/icon-transactions"
import { LargeButton } from "../../components/large-button"
import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import type { ContactStackParamList } from "../../navigation/stack-param-lists"
import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp } from "@react-navigation/native"
import type { ScreenType } from "../../types/jsx"
import { ContactTransactionsDataInjected } from "./contact-transactions"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  actionsContainer: { paddingBottom: 18 },

  amount: {
    color: palette.white,
    fontSize: "36rem",
  },

  amountSecondary: {
    color: palette.white,
    fontSize: "16rem",
  },

  amountView: {
    alignItems: "center",
    paddingBottom: "6rem",
  },

  icon: { margin: 0 },

  inputContainer: {
    flexDirection: "row",
  },

  inputStyle: { textAlign: "center", textDecorationLine: "underline" },

  screenTitle: { fontSize: 18, marginBottom: 12, marginTop: 18 },

  transactionsView: {
    flex: 1,
    marginHorizontal: "30rem",
  },
})

type ContactDetailProps = {
  route: RouteProp<ContactStackParamList, "contactDetail">
  navigation: StackNavigationProp<ContactStackParamList, "contactDetail">
}

export const ContactsDetailScreen: ScreenType = ({
  route,
  navigation,
}: ContactDetailProps) => {
  const { contact } = route.params
  const { refetch: refetchMain } = useMainQuery()
  return (
    <ContactsDetailScreenJSX
      navigation={navigation}
      contact={contact}
      refetchMain={refetchMain}
    />
  )
}

type ContactDetailScreenProps = {
  contact: Contact
  navigation: StackNavigationProp<ContactStackParamList, "contactDetail">
  refetchMain: () => void
}

export const ContactsDetailScreenJSX: ScreenType = ({
  contact,
  navigation,
  refetchMain,
}: ContactDetailScreenProps) => {
  const [contactName, setContactName] = React.useState(contact.alias)

  const UPDATE_NAME = gql`
    mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {
      userContactUpdateAlias(input: $input) {
        errors {
          message
        }
      }
    }
  `

  const [updateNameMutation] = useMutation(UPDATE_NAME, {
    onCompleted: () => refetchMain(),
  })

  const updateName = async () => {
    // TODO: need optimistic updates
    // FIXME this one doesn't work
    await updateNameMutation({
      variables: { input: { username: contact.username, alias: contactName } },
    })
  }

  return (
    <Screen style={styles.screen} unsafe>
      <View style={[styles.amountView, { backgroundColor: palette.green }]}>
        <Icon
          name="ios-person-outline"
          size={86}
          color={palette.white}
          style={styles.icon}
        />
        <View style={styles.inputContainer}>
          <Input
            style={styles.amount}
            inputStyle={styles.inputStyle}
            inputContainerStyle={{ borderColor: palette.green }}
            onChangeText={setContactName}
            onSubmitEditing={updateName}
            onBlur={updateName}
            returnKeyType="done"
          >
            {contact.alias}
          </Input>
        </View>
        <Text style={styles.amountSecondary}>{`${translate("common.username")}: ${
          contact.username
        }`}</Text>
      </View>
      <View style={styles.transactionsView}>
        <Text style={styles.screenTitle}>
          {translate("ContactDetailsScreen.title", {
            input: contact.alias,
          })}
        </Text>
        <ContactTransactionsDataInjected
          navigation={navigation}
          contactUsername={contact.username}
        />
      </View>
      <View style={styles.actionsContainer}>
        <LargeButton
          title={translate("MoveMoneyScreen.send")}
          icon={<IconTransaction isReceive={false} size={32} />}
          onPress={() =>
            navigation.navigate("sendBitcoin", { username: contact.username })
          }
        />
      </View>
      <CloseCross color={palette.white} onPress={navigation.goBack} />
    </Screen>
  )
}
