import { useMemo } from "react"
import { ActivityIndicator, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import {
  ContactsCardQuery,
  UserContact,
  useContactsCardQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  PeopleStackParamList,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import { useAppConfig } from "@app/hooks"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

gql`
  query ContactsCard {
    me {
      id
      contacts {
        id
        handle
        username
        alias
        transactionsCount
      }
    }
  }
`

const Contact = ({ contact }: { contact: UserContact }) => {
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<PeopleStackParamList>>()
  const rootNavigation = navigation.getParent<StackNavigationProp<RootStackParamList>>()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const handle = contact?.handle?.trim() ?? ""
  const displayHandle =
    handle && !handle.includes("@") ? `${handle}@${lnAddressHostname}` : handle

  return (
    <View style={styles.contactContainer}>
      <Text type="p1">{displayHandle}</Text>
      <GaloyIconButton
        onPress={() =>
          rootNavigation.navigate("sendBitcoinDestination", {
            username: contact.handle,
          })
        }
        name="send"
        size="medium"
        iconOnly
      />
    </View>
  )
}

export const ContactsCard = () => {
  const styles = useStyles()

  const { LL } = useI18nContext()

  const isAuthed = useIsAuthed()
  const navigation = useNavigation<StackNavigationProp<PeopleStackParamList>>()

  const { loading, data, error } = useContactsCardQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  if (error) {
    toastShow({ message: error.message, LL })
  }

  const contacts = useMemo(() => (data ? getFrequentContacts(data) : []), [data])

  return (
    <View style={styles.container}>
      <View>
        <View style={styles.contacts}>
          <Text type="h2">{LL.PeopleScreen.frequentContacts()}</Text>
        </View>
        <View style={[styles.separator, styles.spaceTop]}></View>
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : contacts.length === 0 ? (
        <Text type="p2">{LL.PeopleScreen.noContactsTitle()}</Text>
      ) : (
        <>
          <View style={styles.contactsOuterContainer}>
            {contacts.map((contact) => (
              <Contact key={contact.id} contact={contact as UserContact} />
            ))}
          </View>
          <GaloySecondaryButton
            title={LL.PeopleScreen.viewAllContacts()}
            onPress={() => navigation.navigate("allContacts")}
          />
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    display: "flex",
    flexDirection: "column",
    marginBottom: 20,
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
    rowGap: 14,
  },
  contacts: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
  },
  spaceTop: {
    marginTop: 8,
  },
  textCenter: {
    textAlign: "center",
  },
  contactsOuterContainer: {
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
  },
  contactContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 3,
  },
}))

// ---- HELPERS ----
const getFrequentContacts = (data: ContactsCardQuery) => {
  // Extract the contacts
  const _contacts = data?.me?.contacts || []
  const contacts = [..._contacts] // Convert from readyonlyarray to regular array

  // Sort contacts by the `transactionsCount` in descending order
  contacts.sort((a, b) => {
    return b.transactionsCount - a.transactionsCount
  })

  // return top 3
  return contacts.slice(0, 3)
}
