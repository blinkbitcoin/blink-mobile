import NfcManager, { NfcTech, Ndef, NfcError } from "react-native-nfc-manager"
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

type ScanCardUidReturn = {
  success: boolean
  uid: string
  errorMessage: string
}

export const writeNfcTag = async (
  lnurlEncodedString: string,
  payUrlString: string,
): Promise<WriteNfcReturn> => {
  const result = {
    success: false,
    errorMessage: "",
  }

  try {
    const isSupported = await NfcManager.isSupported()

    if (!isSupported) {
      throw new NfcError.UnsupportedFeature()
    }

    const isEnabled = await NfcManager.isEnabled()

    if(!isEnabled) {
      throw new NfcError.RadioDisabled()
    }

    NfcManager.start()

    if (Platform.OS == "android") {
      modalNfcVisibleVar(true)
    }

    await NfcManager.requestTechnology(NfcTech.Ndef)

    const bytes = Ndef.encodeMessage([
      Ndef.uriRecord(payUrlString),
      Ndef.uriRecord(lnurlEncodedString),
    ])

    await NfcManager.ndefHandler.writeNdefMessage(bytes)

    if (!__DEV__) {
      await NfcManager.ndefHandler.makeReadOnly()
    }

    if (Platform.OS === 'ios') {
      await NfcManager.setAlertMessageIOS('Success');
    }

    result.success = true
  } catch (ex) {
    result.errorMessage = getErrorType(ex)
  } finally {
    NfcManager.cancelTechnologyRequest()
  }

  if (Platform.OS == "android") {
    modalNfcVisibleVar(false)
  }

  if (!result.success && !result.errorMessage) {
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

  try {
    const isSupported = await NfcManager.isSupported()

    if (!isSupported) {
      throw new NfcError.UnsupportedFeature()
    }

    const isEnabled = await NfcManager.isEnabled()

    if(!isEnabled) {
      throw new NfcError.RadioDisabled()
    }

    NfcManager.start()

    if (Platform.OS == "android") {
      modalNfcVisibleVar(true)
    }

    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.IsoDep])

    const tag = await NfcManager.getTag()

    if (Platform.OS === 'ios') {
      await NfcManager.setAlertMessageIOS('Success');
    }

    const message = tag?.ndefMessage?.find(
      (el) => {
        const payload = Ndef.text.decodePayload(new Uint8Array(el.payload))

        el.payload = payload.replace("LIGHTNING://", "").replace("LIGHTNING:", "").replace("lightning://", "").replace("lightning:", "")
        return el.payload.toUpperCase().indexOf("LNURL") !== -1
      } 
    )

    if (message && message?.payload) {
      result.data = message.payload
      result.success = true
    } else {
      throw NfcError.FirstNdefInvalid()
    }
  } catch (ex) {
    result.errorMessage = getErrorType(ex)
  } finally {
    NfcManager.cancelTechnologyRequest()
  }

  if (Platform.OS == "android") {
    modalNfcVisibleVar(false)
  }

  if (!result.success && !result.errorMessage) {
    result.errorMessage = "Unexpected"
  }

  return result
}

/**
 * Scans an NFC card to get its UID for Bolt Card registration
 * @returns An object containing the success status, UID (if successful), and error message (if failed)
 */
export const scanCardUid = async (): Promise<ScanCardUidReturn> => {
  const result = {
    success: false,
    uid: "",
    errorMessage: "",
  }

  try {
    const isSupported = await NfcManager.isSupported()

    if (!isSupported) {
      throw new NfcError.UnsupportedFeature()
    }

    const isEnabled = await NfcManager.isEnabled()

    if(!isEnabled) {
      throw new NfcError.RadioDisabled()
    }

    NfcManager.start()

    if (Platform.OS == "android") {
      modalNfcVisibleVar(true)
    }

    // Request ISO-DEP technology which gives us access to the card's UID
    await NfcManager.requestTechnology(NfcTech.IsoDep)

    // Get the tag information
    const tag = await NfcManager.getTag()
    
    if (Platform.OS === 'ios') {
      await NfcManager.setAlertMessageIOS('Success');
    }

    // Extract the UID from the tag
    if (tag && tag.id) {
      // The tag.id is typically a byte array that needs to be converted to a hex string
      let uid = ""
      
      if (Array.isArray(tag.id)) {
        // Convert byte array to hex string
        uid = Array.from(tag.id)
          .map(byte => (byte < 16 ? '0' : '') + byte.toString(16))
          .join('')
          .toUpperCase()
      } else if (typeof tag.id === 'string') {
        // If it's already a string, just use it
        uid = tag.id.toUpperCase()
      }
      
      if (uid) {
        result.uid = uid
        result.success = true
      } else {
        throw new Error("Could not convert card UID to string")
      }
    } else {
      throw new Error("Could not read card UID")
    }
  } catch (ex) {
    result.errorMessage = getErrorType(ex)
  } finally {
    NfcManager.cancelTechnologyRequest()
  }

  if (Platform.OS == "android") {
    modalNfcVisibleVar(false)
  }

  if (!result.success && !result.errorMessage) {
    result.errorMessage = "Unexpected"
  }

  return result
}

const getErrorType = (ex) => {
  if (ex instanceof NfcError.UnsupportedFeature) {
    return "UnsupportedFeature"
  } else if (ex instanceof NfcError.SecurityViolation) {
    return "SecurityViolation"
  } else if (ex instanceof NfcError.InvalidParameter) {
    return "InvalidParameter"
  } else if (ex instanceof NfcError.InvalidParameterLength) {
    return "InvalidParameterLength"
  } else if (ex instanceof NfcError.ParameterOutOfBound) {
    return "ParameterOutOfBound"
  } else if (ex instanceof NfcError.RadioDisabled) {
    return "RadioDisabled"
  } else if (ex instanceof NfcError.TagConnectionLost) {
    return "TagConnectionLost"
  } else if (ex instanceof NfcError.RetryExceeded) {
    return "RetryExceeded"
  } else if (ex instanceof NfcError.TagResponseError) {
    return "TagResponseError"
  } else if (ex instanceof NfcError.SessionInvalidated) {
    return "SessionInvalidated"
  } else if (ex instanceof NfcError.TagNotConnected) {
    return "TagNotConnected"
  } else if (ex instanceof NfcError.PacketTooLong) {
    return "PacketTooLong"
  } else if (ex instanceof NfcError.UserCancel) {
    return "UserCancel"
  } else if (ex instanceof NfcError.Timeout) {
    return "Timeout"
  } else if (ex instanceof NfcError.Unexpected) {
    return "Unexpected"
  } else if (ex instanceof NfcError.SystemBusy) {
    return "SystemBusy"
  } else if (ex instanceof NfcError.FirstNdefInvalid) {
    return "FirstNdefInvalid"
  } else if (ex instanceof NfcError.InvalidConfiguration) {
    return "InvalidConfiguration"
  } else if (ex instanceof NfcError.TagNotWritable) {
    return "TagNotWritable"
  } else if (ex instanceof NfcError.TagUpdateFailure) {
    return "TagUpdateFailure"
  } else if (ex instanceof NfcError.TagSizeTooSmall) {
    return "TagSizeTooSmall"
  } else if (ex instanceof NfcError.ZeroLengthMessage) {
    return "ZeroLengthMessage"
  }
}
