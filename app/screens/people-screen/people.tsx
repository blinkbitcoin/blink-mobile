import * as React from "react"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { CirclesCardPeopleHome } from "./circles/circles-card-people-home"
import { InviteFriendsCard } from "./circles/invite-friends-card"
import { ContactsCard } from "./contacts/contacts-card"

export const PeopleScreen: React.FC = () => {
  const styles = useStyles()

  return (
    <Screen style={styles.screen} preset="scroll" headerShown={false}>
      <CirclesCardPeopleHome />
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
