import { useState, useRef } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native"
import { TextInput } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import { Screen } from "@app/components/screen"
import {
  SupportChatDocument,
  SupportChatQuery,
  SupportRole,
  useSupportChatMessageAddMutation,
  useSupportChatQuery,
  useSupportChatResetMutation,
} from "@app/graphql/generated"
import { useActionSheet } from "@expo/react-native-action-sheet"
import Clipboard from "@react-native-clipboard/clipboard"
import { Text, makeStyles, useTheme } from "@rneui/themed"
import Markdown from "@ronradtke/react-native-markdown-display"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation } from "@react-navigation/native"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"

type SupportChatMe = SupportChatQuery["me"]
type SupportChatArray = NonNullable<SupportChatMe>["supportChat"]
type SupportChatMessage = NonNullable<SupportChatArray>[number]

gql`
  query supportChat {
    me {
      id
      supportChat {
        id
        message
        role
        timestamp
      }
    }
  }

  mutation supportChatMessageAdd($input: SupportChatMessageAddInput!) {
    supportChatMessageAdd(input: $input) {
      errors {
        message
      }
      supportMessage {
        id
        message
        role
        timestamp
      }
    }
  }

  mutation supportChatReset {
    supportChatReset {
      success
    }
  }
`

export const SupportChatScreen = () => {
  const styles = useStyles()
  const { theme } = useTheme()

  const supportChatQuery = useSupportChatQuery()
  const supportChat = supportChatQuery.data?.me?.supportChat ?? []

  const flatListRef = useRef<FlatList<SupportChatMessage>>(null)

  const [supportChatMessageAdd, { loading }] = useSupportChatMessageAddMutation()

  const [input, setInput] = useState<string>("")
  const [pendingInput, setPendingInput] = useState<string>("")

  const [supportChatReset] = useSupportChatResetMutation()
  const { LL } = useI18nContext()

  const maybeResetChat = () => {
    Alert.alert(LL.SupportChat.confirmChatReset(), "", [
      {
        text: LL.common.ok(),
        onPress: async () => {
          try {
            const result = await supportChatReset()
            if (result.data?.supportChatReset.success) {
              supportChatQuery.refetch()
            } else {
              Alert.alert(LL.common.error(), LL.SupportChat.errorResettingChat())
            }
          } catch (error) {
            Alert.alert(LL.common.error(), LL.SupportChat.errorResettingChat())
            console.error("Reset chat error: ", error)
          }
        },
      },
      {
        text: LL.common.cancel(),
        style: "cancel",
      },
    ])
  }

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  navigation.setOptions({
    headerRight: () => (
      <TouchableOpacity onPress={maybeResetChat}>
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    ),
  })
  // TODO: replace with cache:
  // ie: adding the SupportRole messaage to the supportChat cache
  const supportChatMaybeInput = pendingInput
    ? [
        ...supportChat,
        {
          role: SupportRole.User,
          message: pendingInput,
          timestamp: new Date().getTime(),
          id: "pending",
          __typename: "SupportMessage" as const,
        },
      ]
    : supportChat

  const { showActionSheetWithOptions } = useActionSheet()

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text)
  }

  async function addMessageToThread() {
    try {
      if (!input) return
      Keyboard.dismiss()
      setPendingInput(input)
      setInput("")
      setTimeout(() => {
        flatListRef.current?.scrollToEnd()
      }, 1000)
      await supportChatMessageAdd({
        variables: { input: { message: input } },
        update: (cache, { data }) => {
          if (!data || !data.supportChatMessageAdd.supportMessage) return

          const newMessages = data.supportChatMessageAdd.supportMessage

          cache.writeQuery({
            query: SupportChatDocument,
            data: {
              me: {
                newMessages,
              },
            },
          })
        },
      })
    } catch (err) {
      Alert.alert(LL.common.error(), LL.SupportChat.errorSendingMessage())
      console.log("error: ", err)
    } finally {
      setPendingInput("")
      setTimeout(() => {
        // TODO: improve code clarity
        // supportChatMaybeInput should be the "cache" version prior to the table update
        // and length will increase by 1 after the update
        // so I think supportChatMaybeInput.length - 1
        // is actually mapping to supportChatMaybeInput.length - 2
        // when consideing the new message
        const indexBeforeLast = supportChatMaybeInput.length - 1
        if (indexBeforeLast >= 0) {
          flatListRef.current?.scrollToIndex({ index: indexBeforeLast, animated: true })
        }
      }, 500)
    }
  }

  function onChangeInputText(v: string) {
    setInput(v)
  }

  // TODO: make it work
  async function clearChat() {
    if (loading) return
    setInput("")
  }

  // FIXME: this is not working
  async function showClipboardActionsheet(text: string) {
    console.log("showClipboardActionsheet", text)

    const cancelButtonIndex = 2
    showActionSheetWithOptions(
      {
        options: ["Copy to clipboard", "Clear chat", "cancel"],
        cancelButtonIndex,
      },
      (selectedIndex) => {
        if (selectedIndex === Number(0)) {
          copyToClipboard(text)
        }
        if (selectedIndex === 1) {
          clearChat()
        }
      },
    )
  }

  function renderItem({ item, index }: { item: SupportChatMessage; index: number }) {
    return (
      <View style={styles.promptResponse} key={index}>
        {item.role === SupportRole.User && (
          <View style={styles.promptTextContainer}>
            <View style={styles.promptTextWrapper}>
              <Text style={styles.promptText}>{item.message}</Text>
            </View>
          </View>
        )}
        {item.role === SupportRole.Assistant && (
          <View style={styles.textStyleContainer}>
            <Markdown style={styles.textStyle}>{item.message}</Markdown>
            <TouchableHighlight
              onPress={() => showClipboardActionsheet(item.message)}
              underlayColor={"transparent"}
            >
              <View style={styles.optionsIconWrapper}>
                <Icon name="apps" size={20} color={theme.colors.primary} />
              </View>
            </TouchableHighlight>
          </View>
        )}
      </View>
    )
  }

  return (
    <Screen preset="fixed" keyboardOffset="navigationHeader">
      <FlatList
        ref={flatListRef}
        data={supportChatMaybeInput}
        renderItem={renderItem}
        scrollEnabled={true}
      />
      {loading && (
        <View style={styles.activityIndicator}>
          <ActivityIndicator size="large" color={theme.colors._orange} />
        </View>
      )}
      <View style={styles.chatInputContainer}>
        <TextInput
          onChangeText={onChangeInputText}
          style={styles.input}
          placeholder="What else do you want to know?"
          placeholderTextColor={theme.colors.grey2}
          autoCorrect={true}
          value={input}
        />
        <TouchableHighlight onPress={addMessageToThread} underlayColor={"transparent"}>
          <View style={styles.chatButton}>
            <Icon name="arrow-up" size={20} color={theme.colors._white} />
          </View>
        </TouchableHighlight>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  optionsIconWrapper: {
    padding: 10,
    paddingTop: 9,
    alignItems: "flex-end",
  },
  promptResponse: {
    marginTop: 10,
  },
  textStyleContainer: {
    borderWidth: 1,
    marginRight: 25,
    borderColor: colors.grey3,
    padding: 15,
    paddingBottom: 6,
    paddingTop: 5,
    margin: 10,
    marginTop: 0,
    borderRadius: 13,
  },
  textStyle: {
    body: {
      color: colors.grey0,
    },
    paragraph: {
      color: colors.grey0,
      fontSize: 16,
    },
    heading1: {
      color: colors.grey0,
      marginVertical: 5,
    },
    heading2: {
      marginTop: 20,
      color: colors.grey0,
      marginBottom: 5,
    },
    heading3: {
      marginTop: 20,
      color: colors.grey0,
      marginBottom: 5,
    },
    heading4: {
      marginTop: 10,
      color: colors.grey0,
      marginBottom: 5,
    },
    heading5: {
      marginTop: 10,
      color: colors.grey0,
      marginBottom: 5,
    },
    heading6: {
      color: colors.grey0,
      marginVertical: 5,
    },
    /* eslint-disable camelcase */
    list_item: {
      marginTop: 7,
      fontSize: 16,
    },
    ordered_list_icon: {
      color: colors.grey0,
      fontSize: 16,
    },
    bullet_list: {
      marginTop: 10,
    },
    ordered_list: {
      marginTop: 7,
    },
    bullet_list_icon: {
      color: colors.grey0,
      fontSize: 16,
    },
    code_inline: {
      color: colors.grey1,
      backgroundColor: colors.grey4,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, .1)",
    },
    /* eslint-enable camelcase */
    hr: {
      backgroundColor: "rgba(255, 255, 255, .1)",
      height: 1,
    },
    fence: {
      marginVertical: 5,
      padding: 10,
      color: colors.grey1,
      backgroundColor: colors.grey4,
      borderColor: "rgba(255, 255, 255, .1)",
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: "rgba(255, 255, 255, .2)",
      flexDirection: "row",
    },
    table: {
      marginTop: 7,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, .2)",
      borderRadius: 3,
    },
    blockquote: {
      backgroundColor: "#312e2e",
      borderColor: "#CCC",
      borderLeftWidth: 4,
      marginLeft: 5,
      paddingHorizontal: 5,
      marginVertical: 5,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  promptTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 15,
    marginLeft: 24,
  },
  promptTextWrapper: {
    borderRadius: 8,
    borderTopRightRadius: 0,
    backgroundColor: colors._lightBlue,
  },
  promptText: {
    color: colors._white,
    paddingVertical: 5,
    paddingHorizontal: 9,
    fontSize: 16,
  },
  chatInputContainer: {
    paddingTop: 5,
    borderColor: colors.grey3,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 5,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 99,
    color: colors.grey0,
    marginHorizontal: 10,
    paddingVertical: 10,
    paddingHorizontal: 21,
    paddingRight: 39,
    borderColor: colors.grey4,
  },
  chatButton: {
    marginRight: 14,
    padding: 5,
    borderRadius: 99,
    backgroundColor: colors._lightBlue,
  },
  activityIndicator: { padding: 10 },
  clearText: { marginRight: 15 },
}))
