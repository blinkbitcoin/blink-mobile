import { useCallback, useEffect, useState } from "react"

import { reportError } from "@app/utils/error-logging"

/** How many failed retries stand in for "this is not going to clear on its own". Low
 *  enough that a trapped user is not left tapping, high enough that one bad read does not
 *  send a recoverable device to support. */
export const MAX_RETRIES_BEFORE_STORAGE_HANDOVER = 3

type StorageReadFailureInputs = {
  isMigrationLocked: boolean
  /** Either local read (the checkpoint, the pending wallet) failed. */
  hasResumeDataError: boolean
  /** Any of the three server-backed reads failed. */
  hasServerDataError: boolean
}

/** Whether the failure on screen is this device's store rather than the server's. Only the
 *  locked flow qualifies (unlocked, the user can still walk away) and only when the server
 *  reads were fine. Pure and exported because the gate cannot observe its three inputs
 *  apart. */
export const isStorageReadFailure = ({
  isMigrationLocked,
  hasResumeDataError,
  hasServerDataError,
}: StorageReadFailureInputs): boolean =>
  isMigrationLocked && hasResumeDataError && !hasServerDataError

type UseStorageHandoverArgs = StorageReadFailureInputs & {
  /** Refetches every source the gate reads. Rejections are reported here, so the caller
   *  hands over the raw promise rather than a pre-swallowed one. */
  refetchGateData: () => Promise<unknown>
}

type UseStorageHandover = {
  isStorageReadFailure: boolean
  isRetrying: boolean
  retry: () => Promise<void>
  shouldOfferHandover: boolean
}

/** The gate's storage escape as one unit. Offered on repeated failure rather than on a
 *  diagnosis: the store's message cannot say whether a failure will clear, so repeated
 *  failure is the only honest evidence that retrying is not working. */
export const useStorageHandover = ({
  isMigrationLocked,
  hasResumeDataError,
  hasServerDataError,
  refetchGateData,
}: UseStorageHandoverArgs): UseStorageHandover => {
  /** Retry must not fail silently: catch the rejection, and disable/spin the button while it
   *  is in flight so repeated taps cannot stack requests over an unchanged error screen. */
  const [isRetrying, setIsRetrying] = useState(false)
  const [storageRetryAttempts, setStorageRetryAttempts] = useState(0)

  const isDeviceStorageFailure = isStorageReadFailure({
    isMigrationLocked,
    hasResumeDataError,
    hasServerDataError,
  })

  const retry = useCallback(async (): Promise<void> => {
    setIsRetrying(true)
    /** Only this device's failures count. A retry made while the network is what failed
     *  says nothing about whether the store will ever answer, and carrying those attempts
     *  over would arm the handover on the first local read that fails. */
    if (isDeviceStorageFailure) setStorageRetryAttempts((previous) => previous + 1)
    try {
      await refetchGateData()
    } catch (err) {
      reportError("Migration gate retry", err)
    } finally {
      setIsRetrying(false)
    }
  }, [isDeviceStorageFailure, refetchGateData])

  /** The count belongs to one run of storage failures. A read that finally lands puts the
   *  user back in the flow, and a failure that turns out to be the network's is not
   *  evidence about this device, so neither may carry attempts into the next. */
  useEffect(() => {
    if (isDeviceStorageFailure) return
    setStorageRetryAttempts(0)
  }, [isDeviceStorageFailure])

  const hasExhaustedRetries = storageRetryAttempts >= MAX_RETRIES_BEFORE_STORAGE_HANDOVER
  /** Held back while a retry is in flight: the count rises when one starts, so the last one
   *  may still be about to succeed, and this button — unlike the primary, which disables
   *  itself — would otherwise be tappable straight onto a handover the user did not need. */
  const shouldOfferHandover = isDeviceStorageFailure && hasExhaustedRetries && !isRetrying

  return {
    isStorageReadFailure: isDeviceStorageFailure,
    isRetrying,
    retry,
    shouldOfferHandover,
  }
}
