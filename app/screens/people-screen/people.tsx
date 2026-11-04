import * as React from "react"

import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { makeStyles } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { CirclesCardPeopleHome } from "./circles/circles-card-people-home"
import { InviteFriendsCard } from "./circles/invite-friends-card"
import { ContactsCard } from "./contacts/contacts-card"

export const PeopleScreen: React.FC = () => {
  const styles = useStyles()
  const isSelfCustodial = useIsSelfCustodialAccount()

  return (
    <Screen
      style={styles.screen}
      preset="scroll"
      headerShown={false}
      edges={["top", "left", "right"]}
    >
      {!isSelfCustodial && <CirclesCardPeopleHome />}
      <ContactsCard />
      <InviteFriendsCard />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  screen: {
    padding: 20,
  },
}))
