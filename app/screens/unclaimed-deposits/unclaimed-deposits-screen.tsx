import React, { useState } from "react"
import { ActivityIndicator, Pressable, TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { DepositStatus } from "@app/types/payment"
import { testProps } from "@app/utils/testProps"

import { buildFeeTierOptions } from "../send-bitcoin-screen/fee-tier-options"
import { FeeTierOption } from "../send-bitcoin-screen/hooks/fee-tiers.types"

import { DepositErrorMessage } from "./deposit-error-message"
import { useDepositActions } from "./hooks/use-deposit-actions"
import {
  getFeeRateSatPerVb,
  useRecommendedFeeTiers,
} from "./hooks/use-recommended-fee-tiers"
import { ADDRESS_PLACEHOLDER, openMempoolTx } from "./utils"

export const UnclaimedDepositsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const { sdk } = useSelfCustodialWallet()

  const { deposits, isBusy, isProcessing, handleClaim, handleRefund, DepositActionType } =
    useDepositActions()

  const [refundDepositId, setRefundDepositId] = useState<string | null>(null)
  const [refundAddress, setRefundAddress] = useState("")
  const [feeTier, setFeeTier] = useState<FeeTierOption>(FeeTierOption.Medium)

  const { tiers: feeTiers, error: feeTiersError } = useRecommendedFeeTiers(
    sdk ?? null,
    refundDepositId !== null,
  )
  const feeTierOptions = buildFeeTierOptions({
    tiers: feeTiers,
    labels: {
      [FeeTierOption.Fast]: LL.SendBitcoinScreen.fast(),
      [FeeTierOption.Medium]: LL.SendBitcoinScreen.medium(),
      [FeeTierOption.Slow]: LL.SendBitcoinScreen.slow(),
    },
    formatSats: (rate) => LL.UnclaimedDeposit.feeRateUnit({ rate }),
    locale,
  })

  const isRefundMode = refundDepositId !== null
  const hasAddress = refundAddress.trim().length > 0
  const selectedFeeRate = feeTiers[feeTier].feeSats
  const canSubmitRefund = hasAddress && feeTiersError === null && selectedFeeRate > 0

  const resetRefund = () => {
    setRefundDepositId(null)
    setRefundAddress("")
    setFeeTier(FeeTierOption.Medium)
  }

  const onRefund = async (depositId: string) => {
    const deposit = deposits.find(({ id }) => id === depositId)
    if (!deposit) return

    const rates = getFeeRateSatPerVb(feeTiers)
    const success = await handleRefund(deposit, refundAddress.trim(), rates[feeTier])
    if (success) resetRefund()
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        {deposits.length === 0 && (
          <Text style={styles.emptyText}>{LL.UnclaimedDeposit.error()}</Text>
        )}

        {deposits.map((deposit) => {
          const isRefunding = refundDepositId === deposit.id

          return (
            <View key={deposit.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {LL.UnclaimedDeposit.cardTitle({
                  sats: deposit.amount.amount.toLocaleString(),
                })}
              </Text>

              <Pressable style={styles.txRow} onPress={() => openMempoolTx(deposit.txid)}>
                <Text style={styles.txLink} numberOfLines={1} ellipsizeMode="middle">
                  {deposit.txid}
                </Text>
                <GaloyIcon name="link" size={12} color={colors.primary} />
              </Pressable>

              {deposit.status === DepositStatus.Immature && (
                <Text style={styles.mutedText}>{LL.UnclaimedDeposit.immature()}</Text>
              )}

              {deposit.status !== DepositStatus.Immature && !isRefunding && (
                <View style={styles.actions}>
                  {isProcessing(deposit.id, DepositActionType.Claim) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <GaloyTertiaryButton
                      title={LL.UnclaimedDeposit.claim()}
                      onPress={() => handleClaim(deposit)}
                      disabled={isBusy || isRefundMode}
                      {...testProps(`claim-${deposit.id}`)}
                    />
                  )}
                  <GaloyTertiaryButton
                    title={LL.UnclaimedDeposit.refund()}
                    outline
                    onPress={() => setRefundDepositId(deposit.id)}
                    disabled={isBusy}
                    {...testProps(`refund-toggle-${deposit.id}`)}
                  />
                </View>
              )}

              {isRefunding && (
                <View style={styles.refundPanel}>
                  <View>
                    <Text style={styles.fieldLabel}>
                      {LL.UnclaimedDeposit.refundAddress()}
                    </Text>
                    <View style={styles.fieldInput}>
                      <TextInput
                        style={styles.fieldInputText}
                        placeholder={ADDRESS_PLACEHOLDER}
                        placeholderTextColor={colors.grey2}
                        value={refundAddress}
                        onChangeText={setRefundAddress}
                        autoCapitalize="none"
                        autoCorrect={false}
                        {...testProps("refund-address-input")}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>{LL.UnclaimedDeposit.feeRate()}</Text>
                    <View style={styles.fieldGroup}>
                      {feeTierOptions.map(({ id, label, detail }) => (
                        <CheckboxRow
                          key={id}
                          label={`${label} ${detail}`}
                          isChecked={feeTier === id}
                          onPress={() => setFeeTier(id as FeeTierOption)}
                        />
                      ))}
                    </View>
                    {feeTiersError !== null && (
                      <Text style={styles.errorText}>
                        {LL.UnclaimedDeposit.feeRateUnavailable()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.actions}>
                    <GaloyTertiaryButton
                      title={LL.common.cancel()}
                      outline
                      onPress={resetRefund}
                      disabled={isBusy}
                      {...testProps("cancel-refund")}
                    />
                    {isProcessing(deposit.id, DepositActionType.Refund) ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <GaloyTertiaryButton
                        title={LL.UnclaimedDeposit.refundNow()}
                        onPress={() => onRefund(deposit.id)}
                        disabled={!canSubmitRefund || isBusy}
                        {...testProps("refund-now-button")}
                      />
                    )}
                  </View>
                </View>
              )}

              <DepositErrorMessage deposit={deposit} />
            </View>
          )
        })}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 16,
  },
  emptyText: {
    textAlign: "center",
    color: colors.grey2,
    marginTop: 40,
  },
  card: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  txLink: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: "Source Sans Pro",
    flex: 1,
  },
  mutedText: {
    fontSize: 12,
    color: colors.grey2,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  refundPanel: {
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.grey4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.grey2,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  fieldInputText: {
    fontSize: 14,
    color: colors.black,
    fontFamily: "Source Sans Pro",
  },
  fieldGroup: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
}))
