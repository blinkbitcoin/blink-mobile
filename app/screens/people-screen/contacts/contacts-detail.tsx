import * as React from "react"
import { View } from "react-native"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { IconHero } from "@app/components/icon-hero"
import { UserContact } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { getLightningAddress } from "@app/utils/pay-links"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { Screen } from "../../../components/screen"
import type {
  PeopleStackParamList,
  RootStackParamList,
} from "../../../navigation/stack-param-lists"
import { ContactTransactions } from "./contact-transactions"

/** An address is one unbreakable thing: it is cut short rather than wrapped. */
const ADDRESS_LINES = 1

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

export const ContactsDetailScreenJSX: React.FC<ContactDetailScreenProps> = ({
  contact,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "transactionHistory">>()

  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  /** An address is only built from a handle there is one: the helper would otherwise
   *  hand the header a bare "@domain". */
  const handle = contact.handle.trim()
  const lightningAddress = handle ? getLightningAddress(lnAddressHostname, handle) : ""

  return (
    <Screen>
      <IconHero
        icon="user"
        iconColor={colors.black}
        title={lightningAddress}
        titleLines={ADDRESS_LINES}
      />
      <View style={styles.body}>
        <ContactTransactions contact={contact} />
        <View style={styles.sendContainer}>
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
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  body: {
    flex: 1,
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  sendContainer: {
    alignItems: "center",
  },
}))
