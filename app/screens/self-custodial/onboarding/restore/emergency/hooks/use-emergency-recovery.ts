import { useCallback, useEffect, useRef, useState } from "react"
import Clipboard from "@react-native-clipboard/clipboard"
import Share from "react-native-share"

import { useI18nContext } from "@app/i18n/i18n-react"
import {
  BundleFilePickStatus,
  pickEmergencyBundleFile,
} from "@app/self-custodial/recovery-bundle/bundle-file"
import { attemptSilentCloudFetch } from "@app/self-custodial/recovery-bundle/cloud"
import {
  type EmergencyBundleRejection,
  expectedBundleFilename,
  verifyEmergencyBundle,
  type VerifiedEmergencyBundle,
} from "@app/self-custodial/recovery-bundle/emergency-recovery"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { networkLabelFor } from "@app/self-custodial/config"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { usePlatformCloudBackup } from "../../../hooks/use-platform-cloud-backup"

export const EmergencyRecoveryStep = {
  Verifying: "verifying",
  /** Nothing was found automatically: ask where the bundle is. */
  Sources: "sources",
  Rejected: "rejected",
  Verified: "verified",
  Summary: "summary",
} as const

export type EmergencyRecoveryStep =
  (typeof EmergencyRecoveryStep)[keyof typeof EmergencyRecoveryStep]

/** Long enough to read the confirmation, short enough not to feel like a stall. */
export const VERIFIED_DWELL_MS = 1800

const ERROR_CONTEXT = "Emergency bundle recovery"

/**
 * The emergency-recovery flow: prove a bundle belongs to the phrase the user
 * just entered, with the operators down.
 *
 * It looks before it asks. The phrase names the user's bundle exactly, so the
 * first thing this does is fetch that file from their cloud without a sign-in
 * prompt. Only when that finds nothing does it ask them to go and get it -
 * getting this order backwards would send every cloud-backup user hunting
 * through their files at the worst possible moment.
 *
 * All three sources (cloud, password manager, file) hand a string to the same
 * verifier, so they cannot drift apart in what they accept.
 */
export const useEmergencyRecovery = (mnemonic: string) => {
  const { LL } = useI18nContext()
  const network = useSparkNetwork()
  const cloudBackup = usePlatformCloudBackup()

  const [step, setStep] = useState<EmergencyRecoveryStep>(
    EmergencyRecoveryStep.Verifying,
  )
  const [rejection, setRejection] = useState<EmergencyBundleRejection | null>(null)
  const [verified, setVerified] = useState<VerifiedEmergencyBundle | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (payload: string) => {
      setStep(EmergencyRecoveryStep.Verifying)
      const outcome = await verifyEmergencyBundle(payload, mnemonic)
      if (outcome.verified) {
        setVerified(outcome.result)
        setRejection(null)
        setStep(EmergencyRecoveryStep.Verified)
        return
      }
      setRejection(outcome.rejection)
      setStep(EmergencyRecoveryStep.Rejected)
    },
    [mnemonic],
  )

  const attemptedRef = useRef(false)
  useEffect(() => {
    if (attemptedRef.current) return
    attemptedRef.current = true

    const attemptAutomatically = async () => {
      try {
        const fileName = await expectedBundleFilename(mnemonic, network)
        const fetched = await attemptSilentCloudFetch(fileName)
        if (!fetched.success) {
          // Not an error worth reporting: most users reaching here never linked
          // a cloud, which is exactly why the next step exists.
          setStep(EmergencyRecoveryStep.Sources)
          return
        }
        await submit(fetched.content)
      } catch (err) {
        reportError(ERROR_CONTEXT, err)
        setStep(EmergencyRecoveryStep.Sources)
      }
    }

    attemptAutomatically()
  }, [mnemonic, network, submit])

  /** Verified is a confirmation, not a decision, so it moves on by itself. */
  useEffect(() => {
    if (step !== EmergencyRecoveryStep.Verified) return
    const timer = setTimeout(
      () => setStep(EmergencyRecoveryStep.Summary),
      VERIFIED_DWELL_MS,
    )
    return () => clearTimeout(timer)
  }, [step])

  const runSource = useCallback(
    async (load: () => Promise<string | null>) => {
      if (busy) return
      setBusy(true)
      try {
        const payload = await load()
        if (payload !== null) await submit(payload)
      } finally {
        setBusy(false)
      }
    },
    [busy, submit],
  )

  /** Interactive this time: the silent attempt already failed, so a sign-in
   *  prompt is the point rather than an interruption. */
  const fromCloud = useCallback(
    () =>
      runSource(async () => {
        try {
          const fileName = await expectedBundleFilename(mnemonic, network)
          const session = await cloudBackup.startSession(fileName)
          if (!session.success) {
            toastShow({
              message: cloudBackup.resolveErrorMessage(session.reason, LL),
              LL,
            })
            return null
          }
          const { existingFileId, accessToken } = session.session
          if (!existingFileId) {
            toastShow({ message: LL.EmergencyRecovery.notInCloud(), LL })
            return null
          }
          const download = await cloudBackup.downloadById(existingFileId, accessToken)
          if (!download.success) {
            toastShow({
              message: cloudBackup.resolveErrorMessage(download.reason, LL),
              LL,
            })
            return null
          }
          return download.content
        } catch (err) {
          reportError(ERROR_CONTEXT, err)
          toastShow({ message: LL.EmergencyRecovery.sourceFailed(), LL })
          return null
        }
      }),
    [runSource, mnemonic, network, cloudBackup, LL],
  )

  /** A bundle kept as a password-manager secure note comes back as pasted text. */
  const fromClipboard = useCallback(
    () =>
      runSource(async () => {
        const pasted = (await Clipboard.getString()).trim()
        if (!pasted) {
          toastShow({ message: LL.EmergencyRecovery.clipboardEmpty(), LL })
          return null
        }
        return pasted
      }),
    [runSource, LL],
  )

  const fromFile = useCallback(
    () =>
      runSource(async () => {
        const picked = await pickEmergencyBundleFile()
        if (picked.status === BundleFilePickStatus.Unreadable) {
          toastShow({ message: LL.EmergencyRecovery.fileUnreadable(), LL })
        }
        return picked.status === BundleFilePickStatus.Picked ? picked.content : null
      }),
    [runSource, LL],
  )

  /** The bundle may have arrived as pasted text; a file is what the recovery
   *  tooling actually takes. Still encrypted, so this is safe to hand around. */
  const exportBundle = useCallback(async () => {
    if (!verified) return
    try {
      await Share.open({
        title: "blink-recovery-bundle",
        filename: `blink-recovery-bundle-${networkLabelFor(network)}.json`,
        url: `data:application/json;base64,${Buffer.from(verified.payload, "utf8").toString("base64")}`,
        type: "application/json",
      })
    } catch (err) {
      const userCancelled = err instanceof Error && /User did not share/i.test(err.message)
      if (userCancelled) return
      reportError(ERROR_CONTEXT, err)
      toastShow({ message: LL.EmergencyRecovery.sourceFailed(), LL })
    }
  }, [verified, network, LL])

  const tryAnotherSource = useCallback(() => {
    setRejection(null)
    setStep(EmergencyRecoveryStep.Sources)
  }, [])

  return {
    step,
    rejection,
    verified,
    busy,
    fromCloud,
    fromClipboard,
    fromFile,
    tryAnotherSource,
    exportBundle,
  }
}
