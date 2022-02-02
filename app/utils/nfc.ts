import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager"
import { Platform } from "react-native"
import { modalNfcVisibleVar } from "../graphql/client-only-query"

type WriteNfcReturn = {
  success: boolean
  errorMessage: string
}

type ReadNfcReturn = {
  success: boolean
  data: string
  errorMessage: string
}

export const writeNfcTag = async (
  lnurlEncodedString: string,
  payUrlString: string
): Promise<WriteNfcReturn> => {
  const result = {
    success: false,
    errorMessage: "",
  }

  try {
    if (!NfcManager.isSupported()) {
      result.errorMessage = "UnsupportedFeature"
      return result
    }

    if (Platform.OS == "android") {
      modalNfcVisibleVar(true)
    }

    await NfcManager.requestTechnology(NfcTech.Ndef)

    const bytes = Ndef.encodeMessage([
      Ndef.uriRecord(payUrlString),
      Ndef.textRecord(lnurlEncodedString), 
    ])

    await NfcManager.ndefHandler.writeNdefMessage(bytes)

    if (!__DEV__) {
      await NfcManager.ndefHandler.makeReadOnly()
    }

    result.success = true
  } catch (ex) {
    result.errorMessage = ex.constructor.name
  } finally {
    NfcManager.cancelTechnologyRequest()
  }

  if (Platform.OS == "android") {
    modalNfcVisibleVar(false)
  }

  if (!result.success) {
    result.errorMessage = "Unexpected"
  }

  return result
}

export const readNfcTag = async (): Promise<ReadNfcReturn> => {
  const result = {
    success: false,
    data: "",
    errorMessage: "",
  }

  NfcManager.start()

  try {
    if (!NfcManager.isSupported()) {
      result.errorMessage = "UnsupportedFeature"
      return result
    }

    if (Platform.OS == "android") {
      modalNfcVisibleVar(true)
    }

    await NfcManager.requestTechnology(NfcTech.Ndef)

    const tag = await NfcManager.getTag()
    const message = tag?.ndefMessage?.find(el => 
      Ndef.text.decodePayload(new Uint8Array(el.payload))
      .indexOf('lnurl') !== -1
    )

    if (message && message?.payload) {
      result.data = Ndef.text.decodePayload(new Uint8Array(message.payload))
      result.success = true
    }
  } catch (ex) {
    result.errorMessage = ex.constructor.name
  } finally {
    NfcManager.cancelTechnologyRequest()
  }

  if (Platform.OS == "android") {
    modalNfcVisibleVar(false)
  }

  if (!result.success) {
    result.errorMessage = "Unexpected"
  }

  return result
}
