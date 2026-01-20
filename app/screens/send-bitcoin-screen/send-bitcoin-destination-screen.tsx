import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"
import { FlatList } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { LNURL_DOMAINS } from "@app/config"
import { useAppConfig } from "@app/hooks"
import {
  UserContact,
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
  useSendBitcoinDestinationQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logParseDestinationResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import { PaymentType } from "@blinkbitcoin/blink-client"
import Clipboard from "@react-native-clipboard/clipboard"
import { CountryCode, parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js"
import crashlytics from "@react-native-firebase/crashlytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { SearchBar } from "@rn-vui/base"
import { makeStyles, useTheme, Text, ListItem } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { ConfirmDestinationModal } from "./confirm-destination-modal"
import { DestinationInformation } from "./destination-information"
import { parseDestination } from "./payment-destination"
import {
  DestinationDirection,
  InvalidDestinationReason,
} from "./payment-destination/index.types"
import {
  DestinationState,
  SendBitcoinActions,
  SendBitcoinDestinationAction,
  sendBitcoinDestinationReducer,
  SendBitcoinDestinationState,
} from "./send-bitcoin-reducer"
import { PhoneInput, PhoneInputInfo } from "@app/components/phone-input"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { isInt } from "validator"

gql`
  query sendBitcoinDestination {
    globals {
      network
    }
    me {
      id
      defaultAccount {
        id
        wallets {
          id
        }
      }
      contacts {
        id
        handle
        username
        alias
        transactionsCount
      }
    }
  }

  query accountDefaultWallet($walletCurrency: WalletCurrency, $username: Username!) {
    accountDefaultWallet(walletCurrency: $walletCurrency, username: $username) {
      id
    }
  }
`

export const defaultDestinationState: SendBitcoinDestinationState = {
  unparsedDestination: "",
  destinationState: DestinationState.Entering,
}

type Props = {
  route: RouteProp<RootStackParamList, "sendBitcoinDestination">
}
type TInputType = "search" | "phone" | null

const wordMatchesContact = (searchWord: string, contact: UserContact): boolean => {
  let contactPrettyNameMatchesSearchWord: boolean

  const contactNameMatchesSearchWord = contact.handle
    .toLowerCase()
    .includes(searchWord.toLowerCase())

  if (contact.handle) {
    contactPrettyNameMatchesSearchWord = contact.handle
      .toLowerCase()
      .includes(searchWord.toLowerCase())
  } else {
    contactPrettyNameMatchesSearchWord = false
  }

  return contactNameMatchesSearchWord || contactPrettyNameMatchesSearchWord
}

const isPhoneNumber = (handle: string): boolean => {
  try {
    if (isValidPhoneNumber(handle)) return true
    const parsed = parsePhoneNumber(handle)
    return parsed?.isValid() ?? false
  } catch {
    return false
  }
}

const normalizeHandle = (handle?: string) => (handle ?? "").trim().toLowerCase()

const matchCheck = (
  newSearchText: string,
  allContacts: UserContact[],
  activeInput: TInputType,
): UserContact[] => {
  if (newSearchText.length > 0) {
    const searchWordArray = newSearchText
      .split(" ")
      .filter((text) => text.trim().length > 0)

    let filteredContacts = allContacts

    if (activeInput === "phone") {
      filteredContacts = allContacts.filter((contact) => isPhoneNumber(contact.handle))
    }

    const matchingContacts = filteredContacts.filter((contact) =>
      searchWordArray.some((word) => wordMatchesContact(word, contact)),
    )

    return matchingContacts
  }

  if (activeInput === "phone") {
    return allContacts.filter((contact) => isPhoneNumber(contact.handle))
  }

  return allContacts
}

const SendBitcoinDestinationScreen: React.FC<Props> = ({ route }) => {
  const styles = usestyles()
  const {
    theme: { colors },
  } = useTheme()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinDestination">>()
  const isAuthed = useIsAuthed()

  const [destinationState, dispatchDestinationStateAction] = useReducer(
    sendBitcoinDestinationReducer,
    defaultDestinationState,
  )

  const activeInputRef = useRef<TInputType>("search")

  const [rawPhoneNumber, setRawPhoneNumber] = useState<string>("")
  // To don't update the country code as we type
  const [keepCountryCode, setKeepCountryCode] = useState<boolean>(true)
  const [defaultPhoneInputInfo, setDefaultPhoneInputInfo] =
    useState<PhoneInputInfo | null>(null)

  const [goToNextScreenWhenValid, setGoToNextScreenWhenValid] = React.useState(false)

  const { loading, data } = useSendBitcoinDestinationQuery({
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
    skip: !isAuthed,
  })

  // forcing price refresh
  useRealtimePriceQuery({
    fetchPolicy: "network-only",
    skip: !isAuthed,
  })

  const wallets = useMemo(
    () => data?.me?.defaultAccount.wallets,
    [data?.me?.defaultAccount.wallets],
  )
  const bitcoinNetwork = useMemo(() => data?.globals?.network, [data?.globals?.network])
  const contacts = useMemo(() => data?.me?.contacts ?? [], [data?.me?.contacts])
  const contactHandleSet = useMemo(
    () => new Set(contacts.map((contact) => normalizeHandle(contact.handle))),
    [contacts],
  )

  const { LL } = useI18nContext()
  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const [matchingContacts, setMatchingContacts] = useState<UserContact[]>([])

  const allContacts: UserContact[] = useMemo(
    () =>
      (contacts.slice() ?? []).sort((a, b) => {
        return b.transactionsCount - a.transactionsCount
      }),
    [contacts],
  )

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const [selectedId, setSelectedId] = useState("")

  const handleSelection = useCallback((id: string) => {
    setSelectedId((currentId) => (currentId === id ? "" : id))
  }, [])

  let ListEmptyContent: React.ReactNode

  if (loading) {
    ListEmptyContent = (
      <View style={styles.activityIndicatorContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  } else if (
    // TODO: refactor: ideally this should come from destinationState.destination
    // but currently this is not validated when the user is typing,
    // only validated on paste, or when the user is pressing the send button
    // so there is no way to dynamically know if this is a bitcoin or lightning or lnurl
    // until a refactor is done
    destinationState.unparsedDestination.startsWith("bc1") ||
    destinationState.unparsedDestination.startsWith("tb1") ||
    destinationState.unparsedDestination.startsWith("lnurl") ||
    destinationState.unparsedDestination.startsWith("lightning:") ||
    destinationState.unparsedDestination.startsWith("bitcoin:") ||
    destinationState.unparsedDestination.startsWith("1") ||
    destinationState.unparsedDestination.startsWith("3") ||
    destinationState.unparsedDestination.startsWith("lnbc1") ||
    // if the user is typing a lightning address
    // ideally we should filter from the rules below contact from the same instance
    // ie: test and test@blink.sv are the same user
    // but anyhow, more refactor is needed for contacts to have extenral contacts
    destinationState.unparsedDestination.includes("@")
  ) {
    ListEmptyContent = <></>
  } else if (allContacts.length > 0) {
    ListEmptyContent = <></>
  } else {
    ListEmptyContent = <></>
  }

  const updateMatchingContacts = useCallback(
    (newSearchText: string) => {
      const matching = matchCheck(newSearchText, allContacts, activeInputRef.current)
      setMatchingContacts(matching)
    },
    [allContacts],
  )

  const reset = useCallback(() => {
    dispatchDestinationStateAction({
      type: "set-unparsed-destination",
      payload: { unparsedDestination: "" },
    })
    setGoToNextScreenWhenValid(false)
    setSelectedId("")
    updateMatchingContacts("")
  }, [updateMatchingContacts])

  const willInitiateValidation = useCallback(() => {
    if (!bitcoinNetwork || !wallets || !contacts) {
      return false
    }

    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetValidating,
      payload: {},
    })
    return true
  }, [bitcoinNetwork, wallets, contacts])

  const parseValidPhone = useCallback(
    (input: string) => {
      if (!defaultPhoneInputInfo) return null
      try {
        const parsed = parsePhoneNumber(
          input,
          defaultPhoneInputInfo.countryCode as CountryCode,
        )
        if (parsed && parsed.isValid()) {
          return parsed
        }
      } catch {
        return null
      }
      return null
    },
    [defaultPhoneInputInfo],
  )

  const validateDestination = useCallback(
    async (rawInput: string) => {
      // extra check for typescript even though these were checked in willInitiateValidation
      if (!bitcoinNetwork || !wallets || !contacts) {
        return
      }

      const isValidPhone = parseValidPhone(rawInput)

      if (activeInputRef.current === "phone") {
        if (!isValidPhone?.isValid()) {
          dispatchDestinationStateAction({
            type: SendBitcoinActions.SetPhoneInvalid,
            payload: {},
          })
          return
        }
      }

      if (activeInputRef.current === "search") {
        if (isValidPhone?.isValid() || isInt(rawInput)) {
          dispatchDestinationStateAction({
            type: SendBitcoinActions.SetPhoneNotAllowed,
            payload: {},
          })
          return
        }
      }

      const destination = await parseDestination({
        rawInput,
        myWalletIds: wallets.map((wallet) => wallet.id),
        bitcoinNetwork,
        lnurlDomains: [lnAddressHostname, ...LNURL_DOMAINS],
        accountDefaultWalletQuery,
      })
      logParseDestinationResult(destination)

      if (destination.valid === false) {
        if (destination.invalidReason === InvalidDestinationReason.SelfPayment) {
          dispatchDestinationStateAction({
            type: SendBitcoinActions.SetUnparsedDestination,
            payload: {
              unparsedDestination: rawInput,
            },
          })
          navigation.navigate("conversionDetails")
          return
        }

        dispatchDestinationStateAction({
          type: SendBitcoinActions.SetInvalid,
          payload: {
            invalidDestination: destination,
            unparsedDestination: rawInput,
          },
        })
        return
      }

      if (
        destination.destinationDirection === DestinationDirection.Send &&
        destination.validDestination.paymentType === PaymentType.Intraledger
      ) {
        const normalizedHandle = normalizeHandle(destination.validDestination.handle)
        const hasConfirmedUsername =
          normalizeHandle(destinationState.confirmationUsernameType?.username) ===
            normalizedHandle && destinationState.unparsedDestination === rawInput

        if (!contactHandleSet.has(normalizedHandle) && !hasConfirmedUsername) {
          dispatchDestinationStateAction({
            type: SendBitcoinActions.SetRequiresUsernameConfirmation,
            payload: {
              validDestination: destination,
              unparsedDestination: rawInput,
              confirmationUsernameType: {
                type: "new-username",
                username: destination.validDestination.handle,
              },
            },
          })
          return
        }
      }

      dispatchDestinationStateAction({
        type: SendBitcoinActions.SetValid,
        payload: {
          validDestination: destination,
          unparsedDestination: rawInput,
        },
      })
    },
    [
      navigation,
      accountDefaultWalletQuery,
      dispatchDestinationStateAction,
      destinationState,
      contactHandleSet,
      bitcoinNetwork,
      wallets,
      contacts,
      parseValidPhone,
      lnAddressHostname,
    ],
  )

  const handleChangeText = useCallback(
    (newDestination: string) => {
      dispatchDestinationStateAction({
        type: SendBitcoinActions.SetUnparsedDestination,
        payload: { unparsedDestination: newDestination },
      })
      setGoToNextScreenWhenValid(false)
    },
    [dispatchDestinationStateAction, setGoToNextScreenWhenValid],
  )

  useEffect(() => {
    const filteredContacts = matchCheck("", allContacts, activeInputRef.current)
    setMatchingContacts(filteredContacts)
  }, [allContacts])

  useEffect(() => {
    if (destinationState.destinationState === DestinationState.Entering) {
      setSelectedId("")
    }
    if (
      !goToNextScreenWhenValid ||
      destinationState.destinationState !== DestinationState.Valid
    ) {
      return
    }

    if (
      destinationState?.destination?.destinationDirection === DestinationDirection.Send
    ) {
      setGoToNextScreenWhenValid(false)
      navigation.navigate("sendBitcoinDetails", {
        paymentDestination: destinationState.destination,
      })
      return
    }

    if (
      destinationState?.destination?.destinationDirection === DestinationDirection.Receive
    ) {
      setGoToNextScreenWhenValid(false)
      navigation.navigate("redeemBitcoinDetail", {
        receiveDestination: destinationState.destination,
      })
    }
  }, [destinationState, goToNextScreenWhenValid, navigation, setGoToNextScreenWhenValid])

  // setTimeout here allows for the main JS thread to update the UI before the long validateDestination call
  const waitAndValidateDestination = useCallback(
    (input: string) => {
      setTimeout(() => validateDestination(input), 0)
    },
    [validateDestination],
  )

  const initiateGoToNextScreen = useCallback(
    async (input: string) => {
      if (willInitiateValidation()) {
        setGoToNextScreenWhenValid(true)
        waitAndValidateDestination(input)
      }
    },
    [willInitiateValidation, waitAndValidateDestination],
  )

  const resetInput = useCallback(() => {
    reset()
    setDefaultPhoneInputInfo(null)
    setRawPhoneNumber("")
  }, [reset])

  const onFocusedInput = useCallback(
    (inputType: TInputType) => {
      if (activeInputRef.current === inputType) return
      activeInputRef.current = inputType
      resetInput()
    },
    [resetInput],
  )

  useEffect(() => {
    if (route.params?.payment) {
      const text = route.params?.payment
      const isPhoneNumberValid = parseValidPhone(text)
      if (isPhoneNumberValid && isPhoneNumberValid?.isValid()) {
        onFocusedInput("phone")
        setRawPhoneNumber(isPhoneNumberValid.number)
        return
      }
      onFocusedInput("search")
      handleChangeText(route.params?.payment)
      initiateGoToNextScreen(route.params?.payment)
    }
  }, [
    route.params?.payment,
    initiateGoToNextScreen,
    handleChangeText,
    onFocusedInput,
    parseValidPhone,
  ])

  useEffect(() => {
    // If we scan a QR code encoded with a payment url for a specific user e.g. https://{domain}/{username}
    // then we want to detect the username as the destination
    if (route.params?.username) {
      const text = route.params?.username
      const isPhoneNumberValid = parseValidPhone(text)
      if (isPhoneNumberValid && isPhoneNumberValid?.isValid()) {
        onFocusedInput("phone")
        setRawPhoneNumber(isPhoneNumberValid.number)
        return
      }
      onFocusedInput("search")
      handleChangeText(route.params?.username)
    }
  }, [route.params?.username, handleChangeText, onFocusedInput, parseValidPhone])

  const handleScanPress = useCallback(() => {
    setSelectedId("")
    navigation.setParams({ scanPressed: undefined })
    dispatchDestinationStateAction({
      type: SendBitcoinActions.SetUnparsedDestination,
      payload: { unparsedDestination: "" },
    })
    navigation.navigate("scanningQRCode")
  }, [navigation])

  useEffect(() => {
    if (route.params?.scanPressed) {
      handleScanPress()
    }
  }, [route.params?.scanPressed, handleScanPress])

  const handlePaste = useCallback(async () => {
    if (destinationState.destinationState === DestinationState.Validating) return
    onFocusedInput("search")
    try {
      const clipboard = await Clipboard.getString()
      updateMatchingContacts(clipboard)
      dispatchDestinationStateAction({
        type: SendBitcoinActions.SetUnparsedPastedDestination,
        payload: {
          unparsedDestination: clipboard,
        },
      })
      if (willInitiateValidation()) {
        waitAndValidateDestination(clipboard)
      }
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
      }
      toastShow({
        type: "error",
        message: (translations) =>
          translations.SendBitcoinDestinationScreen.clipboardError(),
        LL,
      })
    }
  }, [
    destinationState.destinationState,
    onFocusedInput,
    updateMatchingContacts,
    willInitiateValidation,
    waitAndValidateDestination,
    LL,
  ])

  const handleContactPress = useCallback(
    async (item: UserContact) => {
      if (destinationState.destinationState === DestinationState.Validating) return
      const handle = item?.handle?.trim() ?? ""
      const displayHandle =
        handle && !handle.includes("@") ? `${handle}@${lnAddressHostname}` : handle
      const parsePhone = parseValidPhone(displayHandle)

      if (parsePhone?.isValid() && activeInputRef.current === "search") {
        onFocusedInput("phone")
      }
      updateMatchingContacts(handle)
      handleSelection(item.id)

      if (activeInputRef.current === "phone") {
        setKeepCountryCode(false)
        const international = parsePhone?.number
        dispatchDestinationStateAction({
          type: SendBitcoinActions.SetUnparsedDestination,
          payload: { unparsedDestination: international || displayHandle },
        })
        initiateGoToNextScreen(international || displayHandle)

        setRawPhoneNumber(international || displayHandle)

        setTimeout(() => {
          setKeepCountryCode(true)
        }, 100)
        return
      }

      dispatchDestinationStateAction({
        type: SendBitcoinActions.SetUnparsedDestination,
        payload: { unparsedDestination: displayHandle },
      })
      initiateGoToNextScreen(displayHandle)
    },
    [
      destinationState.destinationState,
      lnAddressHostname,
      parseValidPhone,
      onFocusedInput,
      updateMatchingContacts,
      handleSelection,
      initiateGoToNextScreen,
    ],
  )

  const inputContainerStyle = useMemo(() => {
    switch (destinationState.destinationState) {
      case DestinationState.Validating:
        return styles.enteringInputContainer
      case DestinationState.Invalid:
        return styles.errorInputContainer
      case DestinationState.RequiresUsernameConfirmation:
        return styles.warningInputContainer
      case DestinationState.Valid:
        if (!destinationState.confirmationUsernameType) {
          return styles.validInputContainer
        }
        return styles.warningInputContainer
      case DestinationState.PhoneInvalid:
        return styles.errorInputContainer
      default:
        return {}
    }
  }, [
    destinationState.destinationState,
    destinationState.confirmationUsernameType,
    styles,
  ])

  return (
    <Screen keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <ConfirmDestinationModal
        destinationState={destinationState}
        dispatchDestinationStateAction={dispatchDestinationStateAction}
      />
      <View style={styles.sendBitcoinDestinationContainer}>
        <View
          style={[
            styles.fieldBackground,
            activeInputRef.current === "search" && inputContainerStyle,
            activeInputRef.current === "phone" && styles.disabledInput,
          ]}
        >
          <SearchBar
            {...testProps(LL.SendBitcoinScreen.placeholder())}
            placeholder={LL.SendBitcoinScreen.placeholder()}
            value={
              activeInputRef.current === "search"
                ? destinationState.unparsedDestination
                : ""
            }
            onFocus={() => onFocusedInput("search")}
            onChangeText={(text) => {
              onFocusedInput("search")
              handleChangeText(text)
              updateMatchingContacts(text)
            }}
            onSubmitEditing={() =>
              willInitiateValidation() &&
              waitAndValidateDestination(destinationState.unparsedDestination)
            }
            platform="default"
            showLoading={false}
            containerStyle={[styles.searchBarContainer]}
            inputContainerStyle={styles.searchBarInputContainerStyle}
            inputStyle={styles.searchBarText}
            searchIcon={<></>}
            autoCapitalize="none"
            autoCorrect={false}
            clearIcon={<></>}
          />
          {destinationState.unparsedDestination && activeInputRef.current === "search" ? (
            <Icon
              name="close"
              size={24}
              onPress={resetInput}
              color={styles.icon.color}
              style={styles.iconContainer}
            />
          ) : (
            <TouchableOpacity
              onPress={handlePaste}
              disabled={activeInputRef.current === "phone"}
            >
              <View style={styles.iconContainer}>
                <Text color={colors.primary} type="p2">
                  {LL.common.paste()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        {activeInputRef.current === "search" ? (
          <DestinationInformation destinationState={destinationState} />
        ) : (
          <View style={styles.spacerStyle}></View>
        )}
        <PhoneInputSection
          rawPhoneNumber={rawPhoneNumber}
          setRawPhoneNumber={setRawPhoneNumber}
          activeInputRef={activeInputRef}
          destinationState={destinationState}
          onFocusedInput={onFocusedInput}
          parseValidPhone={parseValidPhone}
          updateMatchingContacts={updateMatchingContacts}
          willInitiateValidation={willInitiateValidation}
          waitAndValidateDestination={waitAndValidateDestination}
          resetInput={resetInput}
          setDefaultPhoneInputInfo={setDefaultPhoneInputInfo}
          inputContainerStyle={inputContainerStyle}
          matchingContacts={matchingContacts}
          keepCountryCode={keepCountryCode}
          setKeepCountryCode={setKeepCountryCode}
          dispatchDestinationStateAction={dispatchDestinationStateAction}
          defaultPhoneInputInfo={defaultPhoneInputInfo}
          handleChangeText={handleChangeText}
        />
        <FlatList
          style={styles.flatList}
          contentContainerStyle={styles.flatListContainer}
          data={matchingContacts}
          extraData={selectedId}
          ListEmptyComponent={ListEmptyContent}
          renderItem={({ item, index }) => {
            const handle = item?.handle?.trim() ?? ""
            const displayHandle =
              handle && !handle.includes("@") ? `${handle}@${lnAddressHostname}` : handle

            return (
              <View
                style={[
                  styles.listContainer,
                  item.id === selectedId && styles.listContainerSelected,
                ]}
              >
                <ListItem
                  key={item.handle}
                  style={[]}
                  containerStyle={[
                    matchingContacts.length > 1 &&
                      matchingContacts.length > index + 1 &&
                      styles.listItemContainer,
                    styles.listItemContainerBase,
                  ]}
                  onPress={() => handleContactPress(item)}
                >
                  <GaloyIcon name={"user"} size={20} />
                  <ListItem.Content>
                    <ListItem.Title
                      style={styles.itemText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {displayHandle}
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              </View>
            )
          }}
          keyExtractor={(item) => item.handle}
        />
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            title={
              destinationState.unparsedDestination
                ? LL.common.next()
                : LL.SendBitcoinScreen.destinationRequired()
            }
            loading={destinationState.destinationState === DestinationState.Validating}
            disabled={
              destinationState.destinationState === DestinationState.Invalid ||
              destinationState.destinationState === DestinationState.PhoneInvalid ||
              !destinationState.unparsedDestination ||
              (activeInputRef.current === "phone" && rawPhoneNumber === "")
            }
            onPress={() => initiateGoToNextScreen(destinationState.unparsedDestination)}
          />
        </View>
      </View>
    </Screen>
  )
}

export default SendBitcoinDestinationScreen

interface PhoneInputSectionProps {
  rawPhoneNumber: string
  setRawPhoneNumber: (value: string) => void
  activeInputRef: React.MutableRefObject<TInputType>
  destinationState: SendBitcoinDestinationState
  onFocusedInput: (inputType: TInputType) => void
  parseValidPhone: (input: string) => ReturnType<typeof parsePhoneNumber> | null
  updateMatchingContacts: (newSearchText: string) => void
  willInitiateValidation: () => boolean
  waitAndValidateDestination: (input: string) => void
  keepCountryCode: boolean
  setKeepCountryCode: (value: boolean) => void
  dispatchDestinationStateAction: React.Dispatch<SendBitcoinDestinationAction>
  resetInput: () => void
  setDefaultPhoneInputInfo: (info: PhoneInputInfo | null) => void
  inputContainerStyle?: object
  matchingContacts: UserContact[]
  defaultPhoneInputInfo: PhoneInputInfo | null
  handleChangeText: (newDestination: string) => void
}

const PhoneInputSection: React.FC<PhoneInputSectionProps> = ({
  rawPhoneNumber,
  setRawPhoneNumber,
  activeInputRef,
  destinationState,
  onFocusedInput,
  parseValidPhone,
  updateMatchingContacts,
  willInitiateValidation,
  waitAndValidateDestination,
  keepCountryCode,
  setKeepCountryCode,
  dispatchDestinationStateAction,
  resetInput,
  setDefaultPhoneInputInfo,
  inputContainerStyle,
  matchingContacts,
  defaultPhoneInputInfo,
  handleChangeText,
}) => {
  const styles = usestyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const handlePastePhone = useCallback(async () => {
    if (destinationState.destinationState === DestinationState.Validating) return
    onFocusedInput("phone")
    setKeepCountryCode(false)

    try {
      const clipboard = await Clipboard.getString()

      let parsed = null
      parsed = parseValidPhone(clipboard)
      const parseNumber = parsed && parsed?.isValid() ? parsed.number : clipboard

      updateMatchingContacts(parseNumber)
      dispatchDestinationStateAction({
        type: SendBitcoinActions.SetUnparsedPastedDestination,
        payload: {
          unparsedDestination: parseNumber,
        },
      })

      if (willInitiateValidation()) {
        waitAndValidateDestination(parseNumber)
        setRawPhoneNumber(parseNumber)
      }
      setTimeout(() => {
        setKeepCountryCode(true)
      }, 100)
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
      }
      toastShow({
        type: "error",
        message: (translations) =>
          translations.SendBitcoinDestinationScreen.clipboardError(),
        LL,
      })
    }
  }, [
    destinationState.destinationState,
    onFocusedInput,
    parseValidPhone,
    updateMatchingContacts,
    willInitiateValidation,
    waitAndValidateDestination,
    LL,
  ])

  useEffect(() => {
    if (!defaultPhoneInputInfo) return
    if (activeInputRef.current === "search") return

    if (
      destinationState.destinationState === DestinationState.Validating ||
      destinationState.destinationState === DestinationState.Pasting
    )
      return

    const { rawPhoneNumber } = defaultPhoneInputInfo
    const rawInput = `+${defaultPhoneInputInfo?.countryCallingCode}${rawPhoneNumber}`

    handleChangeText(rawInput)
    updateMatchingContacts(rawPhoneNumber)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPhoneInputInfo, handleChangeText, updateMatchingContacts])

  // Clear countryCallingCode from input value after pasting or selecting one
  useEffect(() => {
    if (!rawPhoneNumber) return
    if (activeInputRef.current === "search") return
    if (
      destinationState.destinationState === DestinationState.Validating ||
      destinationState.destinationState === DestinationState.Pasting ||
      destinationState.destinationState === DestinationState.Entering
    ) {
      const parse = parseValidPhone(rawPhoneNumber)
      if (
        parse &&
        parse?.isValid() &&
        rawPhoneNumber.includes(`+${defaultPhoneInputInfo?.countryCallingCode}`)
      ) {
        const phoneNumberWithoutArea = rawPhoneNumber.replace(
          `+${defaultPhoneInputInfo?.countryCallingCode}`,
          "",
        )
        setRawPhoneNumber(phoneNumberWithoutArea)
      }
    }
  }, [
    rawPhoneNumber,
    defaultPhoneInputInfo,
    destinationState.destinationState,
    parseValidPhone,
  ])

  return (
    <>
      <View style={styles.textSeparator}>
        <View style={styles.line}></View>
        <View style={styles.textInformationWrapper}>
          <Text style={styles.textInformation}>{LL.SendBitcoinScreen.orBySMS()}</Text>
        </View>
      </View>
      <PhoneInput
        key={1}
        rightIcon={
          rawPhoneNumber && activeInputRef.current === "phone" ? (
            <Icon name="close" size={24} onPress={resetInput} color={colors.primary} />
          ) : (
            <TouchableOpacity
              onPress={handlePastePhone}
              disabled={activeInputRef.current === "search"}
            >
              <Text color={colors.primary} type="p2">
                {LL.common.paste()}
              </Text>
            </TouchableOpacity>
          )
        }
        onChangeText={(text) => {
          onFocusedInput("phone")
          setRawPhoneNumber(text)
        }}
        onChangeInfo={(e) => {
          setDefaultPhoneInputInfo(e)
        }}
        value={activeInputRef.current === "phone" ? rawPhoneNumber : ""}
        isDisabled={activeInputRef.current === "search"}
        onFocus={() => onFocusedInput("phone")}
        onSubmitEditing={() =>
          willInitiateValidation() &&
          waitAndValidateDestination(destinationState.unparsedDestination)
        }
        inputContainerStyle={activeInputRef.current === "phone" && inputContainerStyle}
        bgColor={colors.grey6}
        keepCountryCode={keepCountryCode}
      />
      {activeInputRef.current === "phone" ? (
        <DestinationInformation destinationState={destinationState} />
      ) : (
        <View style={styles.spacerStyle}></View>
      )}
      {matchingContacts.length > 0 && (
        <View style={[styles.textSeparator, styles.lastInfoTextStyle]}>
          <View style={styles.line}></View>
          <View style={styles.textInformationWrapper}>
            <Text style={styles.textInformation}>{LL.SendBitcoinScreen.orSaved()}</Text>
          </View>
        </View>
      )}
    </>
  )
}

const usestyles = makeStyles(({ colors }) => ({
  sendBitcoinDestinationContainer: {
    padding: 20,
    flex: 1,
  },
  fieldBackground: {
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.grey6,
    borderRadius: 10,
    borderColor: colors.transparent,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 60,
  },
  enteringInputContainer: {},
  errorInputContainer: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  validInputContainer: {
    borderColor: colors._green,
    borderWidth: 1,
  },
  warningInputContainer: {
    borderColor: colors.warning,
    borderWidth: 1,
  },
  buttonContainer: {
    marginTop: 26,
    flex: 0,
    justifyContent: "flex-end",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    color: colors.black,
  },
  fieldTitleText: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  searchBarContainer: {
    flex: 1,
    backgroundColor: colors.transparent,
    borderBottomColor: colors.transparent,
    borderTopColor: colors.transparent,
    padding: 0,
  },
  searchBarInputContainerStyle: {
    backgroundColor: colors.transparent,
    marginLeft: -10,
  },
  searchBarText: {
    color: colors.black,
    textDecorationLine: "none",
  },
  icon: {
    color: colors.primary,
  },
  activityIndicatorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  emptyListNoContacts: {
    marginHorizontal: 12,
    marginTop: 32,
  },
  emptyListText: {
    fontSize: 18,
    marginTop: 30,
    textAlign: "center",
    color: colors.black,
  },
  emptyListTitle: {
    color: colors.warning,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  itemContainer: {
    backgroundColor: colors.white,
  },
  itemText: { color: colors.black },
  textSeparator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 35,
    marginBottom: 40,
  },
  lastInfoTextStyle: {
    marginBottom: 30,
  },
  line: {
    backgroundColor: colors.grey4,
    height: 1,
    borderRadius: 10,
    flex: 1,
    position: "relative",
  },
  textInformationWrapper: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    position: "absolute",
    zIndex: 1,
  },
  textInformation: {
    color: colors.grey1,
    textAlign: "center",
    fontSize: 16,
  },
  disabledInput: { opacity: 0.6 },
  borderFocusedInput: {
    borderColor: colors._green,
    borderWidth: 1,
    borderBottomWidth: 1,
  },
  spacerStyle: {
    marginTop: 5,
  },
  flatList: {
    flex: 1,
    marginHorizontal: -30,
  },
  flatListContainer: {},
  listContainer: {
    borderColor: colors.transparent,
    borderWidth: 1,
    marginHorizontal: 32,
    borderRadius: 8,
    overflow: "hidden",
  },
  listContainerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey6,
  },
  listItemContainer: {
    borderColor: colors.grey4,
    borderBottomWidth: 1,
  },
  listItemContainerBase: {
    marginHorizontal: -5,
    backgroundColor: colors.transparent,
  },
}))
