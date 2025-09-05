import React from "react"
import { View } from "react-native"

import { MockedProvider } from "@apollo/client/testing"
import { makeStyles } from "@rn-vui/themed"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import mocks from "../../graphql/mocks"
import { NotificationCardUI } from "./notification-card-ui"

export default {
  title: "Notification Card UI",
  component: NotificationCardUI,
  decorators: [
    (Story) => (
      <MockedProvider mocks={mocks} cache={createCache()}>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
}

export const Default = () => {
  const styles = useStyles()
  return (
    <View style={styles.cardContainer}>
      <NotificationCardUI
        title="title"
        text="text adsfasd asdfasd adsfasd asdfsadf adsfads sdafdsaf asdfads adsfdsa adfdsa dasfdsafd"
        icon="warning"
        action={() => Promise.resolve(console.log("action"))}
      />
      <NotificationCardUI
        title="very long title lets see what happens"
        text="text adsfasd asdfasd adsfasd asdfsadf adsfads sdafdsaf asdfads adsfdsa adfdsa dasfdsafd adsfads adsfasd adsfdsaf"
        icon="warning"
        action={() => Promise.resolve(console.log("action"))}
      />
      <NotificationCardUI
        title="title"
        text="text"
        icon="warning"
        action={() => Promise.resolve(console.log("action"))}
        loading={true}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  cardContainer: {
    rowGap: 20,
    padding: 20,
  },
}))
