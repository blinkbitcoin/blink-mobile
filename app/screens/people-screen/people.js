import * as React from "react";
import { makeStyles } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { CirclesCardPeopleHome } from "./circles/circles-card-people-home";
import { InviteFriendsCard } from "./circles/invite-friends-card";
import { ContactsCard } from "./contacts/contacts-card";
export var PeopleScreen = function () {
    var styles = useStyles();
    return (<Screen style={styles.screen} preset="scroll" headerShown={false}>
      <CirclesCardPeopleHome />
      <ContactsCard />
      <InviteFriendsCard />
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    screen: {
        padding: 20,
    },
}); });
//# sourceMappingURL=people.js.map