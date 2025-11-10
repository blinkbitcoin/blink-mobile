import * as React from "react"
import { View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { UserContact, useUserContactUpdateAliasMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme, Input } from "@rn-vui/themed"

import { CloseCross } from "../../../components/close-cross"
import { Screen } from "../../../components/screen"
import type {
  PeopleStackParamList,
  RootStackParamList,
} from "../../../navigation/stack-param-lists"
import { testProps } from "../../../utils/testProps"
import { ContactTransactions } from "./contact-transactions"

type ContactDetailProps = {
  route: RouteProp<PeopleStackParamList, "contactDetail">
}

export const ContactsDetailScreen: React.FC<ContactDetailProps> = ({ route }) => {
  const { contact } = route.params
  return <ContactsDetailScreenJSX contact={contact} />
}

type ContactDetailScreenProps = {
  contact: UserContact
}

gql`
  mutation userContactUpdateAlias($input: UserContactUpdateAliasInput!) {
    userContactUpdateAlias(input: $input) {
      errors {
        message
      }
      contact {
        alias
        id
      }
    }
  }
`

export const ContactsDetailScreenJSX: React.FC<ContactDetailScreenProps> = ({
  contact,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "transactionHistory">>()

  const [contactName, setContactName] = React.useState(contact.alias)
  const { LL } = useI18nContext()

  // TODO: feature seems broken. need to fix.
  const [userContactUpdateAlias] = useUserContactUpdateAliasMutation({})

  const updateName = async () => {
    // TODO: need optimistic updates
    // FIXME this one doesn't work
    if (contactName) {
      await userContactUpdateAlias({
        variables: { input: { username: contact.username, alias: contactName } },
      })
    }
  }

  return (
    <Screen headerShown={false}>
      <View style={styles.aliasView}>
        <Icon
          {...testProps("contact-detail-icon")}
          name="person-outline"
          size={86}
          color={colors.black}
        />
        <View style={styles.inputContainer}>
          <Input
            style={styles.alias}
            inputStyle={styles.inputStyle}
            inputContainerStyle={{ borderColor: colors.black }}
            onChangeText={setContactName}
            onSubmitEditing={updateName}
            onBlur={updateName}
            returnKeyType="done"
          >
            {contact.alias}
          </Input>
        </View>
        <Text type="p1">{`${LL.common.username()}: ${contact.username}`}</Text>
      </View>
      <View style={styles.contactBodyContainer}>
        <View style={styles.transactionsView}>
          <Text style={styles.screenTitle}>
            {LL.ContactDetailsScreen.title({
              username: contact.alias || contact.username,
            })}
          </Text>
          <ContactTransactions contactUsername={contact.username} />
        </View>
        <View style={styles.actionsContainer}>
          <GaloyIconButton
            name={"send"}
            size="large"
            text={LL.HomeScreen.send()}
            onPress={() =>
              navigation.navigate("sendBitcoinDestination", {
                username: contact.username,
              })
            }
          />
        </View>
      </View>

      <CloseCross color={colors.black} onPress={navigation.goBack} />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  actionsContainer: {
    margin: 12,
  },

  alias: {
    fontSize: 36,
  },

  aliasView: {
    alignItems: "center",
    paddingBottom: 6,
    paddingTop: isIos ? 40 : 10,
  },

  contactBodyContainer: {
    flex: 1,
  },

  inputContainer: {
    flexDirection: "row",
  },

  inputStyle: {
    textAlign: "center",
    textDecorationLine: "underline",
  },

  screenTitle: {
    fontSize: 18,
    marginBottom: 12,
    marginTop: 18,
  },

  transactionsView: {
    flex: 1,
    marginHorizontal: 30,
  },
}))
