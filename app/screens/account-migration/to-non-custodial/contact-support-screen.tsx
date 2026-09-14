import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { IconHero } from "@app/components/icon-hero"
import { IconTextButton } from "@app/components/icon-text-button"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks"
/** Deep import on purpose: its device-location chain stays out of the hooks barrel. */
import { useMigrationSupportEmail } from "@app/screens/account-migration/hooks/use-migration-support-email"
import {
  MigrationSupportOrigin,
  MigrationSupportReason,
  RESTART_RESOLVABLE_REASONS,
} from "@app/types/migration"
import { testProps } from "@app/utils/testProps"

/** One footer control. The house pattern is a primary with a single secondary underneath,
 *  so each variant names exactly two. */
type SupportAction = {
  title: string
  onPress: () => void
  testID: string
}

/** The hero and both footer controls of one variant, chosen together. */
type SupportVariant = {
  icon: IconNamesType
  title: string
  body: string
  primary: SupportAction
  secondary: SupportAction
}

/**
 * The migration failure and help screen: funds are safe, but the transfer needs support
 * assistance. It shows what failed and the account identity (custodial id plus the
 * provisioned wallet's pubkey) so a screenshot alone can open a ticket, and pre-fills the
 * full block, with the platform and app version, into the support email and the copy
 * control. The support address doubles as a copy control: tapping it puts the address on the
 * clipboard, for a user whose mail app the Contact us button cannot open. The header back
 * control and the hardware back return to the commit point (Step 8) when support was opened
 * mid-migration, or dismiss the screen when it was opened by the completed-migration resume
 * handover; the visible control covers iOS, which has no hardware back.
 *
 * Restart-resolvable refusals (#4098) get a self-help variant instead of the support-first
 * copy: the primary control retries the migration in place and Contact support drops to the
 * secondary as the still-stuck fallback. The retry replaces the force-quit the copy used to
 * ask for — an instruction many users cannot follow — and clears the same in-memory latch a
 * relaunch would. The diagnostics card and its copy control stay identical across variants so
 * support still gets the full block either way; only the address-as-copy-control is dropped
 * in self-help, since the footer takes one primary and one secondary, not three.
 */
export const MigrationContactSupportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { params } =
    useRoute<RouteProp<RootStackParamList, "accountMigrationContactSupport">>()

  /** Callers must pass a reason, but a navigation-state restore can land here with none;
   *  a named fallback keeps the ticket meaningful instead of crashing on a missing param. */
  const reason = params?.reason ?? MigrationSupportReason.Unknown
  const isSelfHelp = RESTART_RESOLVABLE_REASONS.has(reason)
  const { cardDetails, supportDetailsText, sendSupportEmail } = useMigrationSupportEmail(
    reason,
    params?.custodialAccountId,
  )

  /** The migration succeeded here, so the generic "something went wrong" would contradict
   *  the success the user was just shown: only the old account is left to close. */
  const isCloseRefused = reason === MigrationSupportReason.CustodialAccountCloseRefused
  const supportFirstBody = isCloseRefused
    ? LLSupport.closeRefusedBody()
    : LLSupport.body()

  /**
   * Back depends on where support was opened from. Mid-migration the commit point (Step 8)
   * is underneath, so Back returns there, skipping the back-swallowing transfer screen a
   * blind goBack would land on. The resume handover is pushed from the root navigator with
   * no migration screens beneath it, so Back dismisses instead of fabricating a fresh commit
   * screen over an already-completed migration, which would re-arm the lock and re-hand the
   * user to support with the wrong reason. The gate handover (a lock with nothing to
   * resume, #4070) has nothing behind it either way: the gate underneath would only replay
   * the handover, and the commit path would fabricate a commit screen for an account with
   * no provisioned wallet, so support is terminal and Back goes nowhere. A restore with no
   * origin keeps the commit path.
   */
  const isResumeOrigin = params?.origin === MigrationSupportOrigin.Resume
  const isGateOrigin = params?.origin === MigrationSupportOrigin.Gate
  /** The delayed handover shares the resume path's Back: the transfer screen is still
   *  mounted underneath watching for the receive, and navigating to the commit screen
   *  would pop it off the stack, taking the gate the user is waiting on with it. */
  const isReceiveDelayedOrigin = params?.origin === MigrationSupportOrigin.ReceiveDelayed
  /** The commit path resets Home underneath before handing over, so it backs out the same
   *  way rather than to a commit screen the migration has already left behind. */
  const isCloseRefusedOrigin = params?.origin === MigrationSupportOrigin.CloseRefused
  const isBackToScreenBeneath =
    isResumeOrigin || isReceiveDelayedOrigin || isCloseRefusedOrigin
  const isBackToCommitScreen = !isGateOrigin && !isBackToScreenBeneath
  const handleBack = useCallback(() => {
    if (isGateOrigin) return
    if (isBackToScreenBeneath) {
      navigation.goBack()
      return
    }
    navigation.navigate("accountMigrationBalancesOverview")
  }, [isGateOrigin, isBackToScreenBeneath, navigation])
  useHardwareBackGuard(handleBack)

  /** The navigator already supplies the back control, so the native one stays hidden or the
   *  header shows two. The gate handover is terminal and keeps no control at all: the header
   *  holds nothing else here, so hiding it outright leaves the same screen without one. */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !isGateOrigin,
      headerBackVisible: false,
    })
  }, [navigation, isGateOrigin])

  /**
   * The commit-time handover is the only origin whose back must not simply pop: the screen
   * beneath it swallows back, so the press is intercepted and redirected to the commit
   * point instead. Every other origin pops, which is already what the header control does.
   *
   * Intercepting through the navigator rather than replacing `headerLeft` is deliberate:
   * `beforeRemove` catches every way off the screen (the header button, the hardware back
   * and the swipe gesture), while a replaced `headerLeft` would only catch the tap.
   * (Replacing it used to crash outright with "Rendered fewer hooks than expected"; that
   * was a repo bug in headerBackControl, fixed in #4176, not a native-stack law.)
   */
  const isRedirectingBackRef = useRef(false)
  useEffect(() => {
    if (!isBackToCommitScreen) return
    return navigation.addListener("beforeRemove", (event) => {
      /** The redirect removes this screen too, as does the self-help retry below; letting a
       *  removal we asked for pass through is what ends the interception instead of looping
       *  on it, or hijacking the retry into a navigate back to the refusal. */
      if (isRedirectingBackRef.current) return
      event.preventDefault()
      isRedirectingBackRef.current = true
      navigation.navigate("accountMigrationBalancesOverview")
    })
  }, [navigation, isBackToCommitScreen])

  const { supportEmailAddress } = useContactSupport()
  const { copyToClipboard } = useClipboard()

  /** Copies the support address so the user can paste it into their own mail app when the
   *  Contact us button's mailto has nowhere to open. */
  const copySupportEmail = useCallback(() => {
    copyToClipboard({ content: supportEmailAddress })
  }, [copyToClipboard, supportEmailAddress])

  /** Copies the full support block the email sends, so a user whose mail app the Contact us
   *  button cannot open can paste it into their own message. */
  const copyDetails = useCallback(() => {
    copyToClipboard({ content: supportDetailsText })
  }, [copyToClipboard, supportDetailsText])

  /**
   * Retries a refused start without asking the user to force-quit. What blocks a second
   * attempt is only in-memory: the commit screen holds the start latch and its settled
   * refusal, and it stays mounted underneath, re-routing here on every focus. Resetting the
   * stack unmounts it, so the entry dispatcher runs again and the screen it lands on fires a
   * fresh migrationStart — the same effect a relaunch has, minus the force-quit. The
   * dispatcher is the target rather than a migration screen because it owns the
   * resume-vs-fresh decision and the self-custodial kill-switch; Primary stays underneath so
   * the user is not stranded in a flow with nothing behind it.
   *
   * The reset removes this screen, which the commit-origin back interception above would
   * otherwise catch and turn into a navigate to the commit point — landing the user back on
   * the screen still holding the refusal. Claiming the redirect ref first marks this removal
   * as one we asked for, so it passes through.
   */
  const retryMigration = useCallback(() => {
    isRedirectingBackRef.current = true
    navigation.reset({
      index: 1,
      routes: [{ name: "Primary" }, { name: "accountMigrationEntry" }],
    })
  }, [navigation])

  /**
   * The variants are complete alternatives — hero and both footer controls switch together,
   * so the choice is made once here rather than per-prop in the JSX. Self-help leads with the
   * retry and keeps support as the secondary; the support-first variant keeps its established
   * footer, where the secondary is the address as a copy control.
   */
  const variant: SupportVariant = isSelfHelp
    ? {
        icon: "refresh",
        title: LLSupport.selfHelp.title(),
        body: LLSupport.selfHelp.body(),
        primary: {
          title: LL.common.tryAgain(),
          onPress: retryMigration,
          testID: "migration-contact-support-retry",
        },
        secondary: {
          title: LLSupport.selfHelp.contactSupportCta(),
          onPress: sendSupportEmail,
          testID: "migration-contact-support-cta",
        },
      }
    : {
        icon: "headset",
        title: LLSupport.title(),
        body: supportFirstBody,
        primary: {
          title: LLSupport.contactUsCta(),
          onPress: sendSupportEmail,
          testID: "migration-contact-support-cta",
        },
        secondary: {
          title: supportEmailAddress,
          onPress: copySupportEmail,
          testID: "migration-contact-support-copy",
        },
      }

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <IconHero
          icon={variant.icon}
          iconColor={colors.primary}
          title={variant.title}
          subtitle={variant.body}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <View style={styles.card}>
            {cardDetails.map((diagnostic) => (
              <View key={diagnostic.label} style={styles.row}>
                <Text style={styles.label}>{diagnostic.label}</Text>
                <Text style={styles.value}>{diagnostic.value}</Text>
              </View>
            ))}
          </View>

          <IconTextButton
            icon="copy-paste"
            label={LLSupport.copy()}
            onPress={copyDetails}
          />
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={variant.primary.title}
            onPress={variant.primary.onPress}
            {...testProps(variant.primary.testID)}
          />
          <GaloySecondaryButton
            title={variant.secondary.title}
            onPress={variant.secondary.onPress}
            {...testProps(variant.secondary.testID)}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 14,
  },
  card: {
    width: "100%",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  label: {
    color: colors.grey2,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 22,
  },
  /** No numberOfLines: every value renders complete, wrapping as needed, because support
   *  needs the whole string (account id, pubkey), never a truncated one. */
  value: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "right",
    maxWidth: 200,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
