import { DEFAULT_TWO_FACTOR_ENFORCEMENT } from "@app/custodial/two-factor-enforcement"
import {
  INITIAL_SESSION_STATE,
  SessionAction,
  SessionRead,
  SessionStart,
  TwoFactorSessionState,
  twoFactorSessionReducer,
} from "@app/custodial/two-factor-session"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorPrompt,
  TwoFactorReminderReason,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

const ACCOUNT = "account-1"
const OTHER_ACCOUNT = "account-2"

const walletsWith = (sats: number, usdCents: number) => [
  { id: "btc-wallet", walletCurrency: WalletCurrency.Btc, balance: sats },
  { id: "usd-wallet", walletCurrency: WalletCurrency.Usd, balance: usdCents },
]

const SATS_CROSSING = { currency: WalletCurrency.Btc, threshold: 5_000_000 }

const recordWith = (
  overrides: Partial<TwoFactorEnforcementRecord> = {},
): TwoFactorEnforcementRecord => ({ ...DEFAULT_TWO_FACTOR_ENFORCEMENT, ...overrides })

const reduce = (state: TwoFactorSessionState, ...actions: SessionAction[]) =>
  actions.reduce(twoFactorSessionReducer, state)

/** A session started for the account with the given record. */
const startedWith = (record: TwoFactorEnforcementRecord): TwoFactorSessionState =>
  reduce(
    INITIAL_SESSION_STATE,
    { type: "accountChanged", accountId: ACCOUNT },
    { type: "recordLoaded", accountId: ACCOUNT, record },
  )

const DECIDED_READ: SessionRead = {
  isAwaitingFreshRead: false,
  unmetTier: TwoFactorTier.Recommended,
  sessionPrompt: TwoFactorSessionPrompt.None,
  isSessionStartDecided: true,
  isCustodyExitOff: false,
}

const dismissal = (
  promptTier: TwoFactorTier,
  read: Partial<SessionRead> = {},
  origin: Extract<SessionAction, { type: "dismissalRegistered" }>["origin"] = {
    prompt: TwoFactorPrompt.ReminderBulletin,
    reason: TwoFactorReminderReason.FirstSessions,
  },
): SessionAction => ({
  type: "dismissalRegistered",
  accountId: ACCOUNT,
  promptTier,
  origin,
  read: { ...DECIDED_READ, unmetTier: promptTier, ...read },
})

describe("twoFactorSessionReducer", () => {
  describe("the account's session", () => {
    it("prepares a session for an account until its record is in", () => {
      const state = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: ACCOUNT,
      })

      expect(state).toMatchObject({
        accountId: ACCOUNT,
        record: null,
        start: SessionStart.Preparing,
      })
    })

    it("owes the start once the record is in", () => {
      expect(startedWith(recordWith())).toMatchObject({
        record: recordWith(),
        start: SessionStart.Owed,
      })
    })

    it("keeps the session when the same account is set again", () => {
      const started = startedWith(recordWith())

      expect(
        twoFactorSessionReducer(started, { type: "accountChanged", accountId: ACCOUNT }),
      ).toBe(started)
    })

    it("starts over for another account, keeping the impressions", () => {
      const shown = reduce(startedWith(recordWith()), {
        type: "promptShown",
        accountId: ACCOUNT,
        prompt: TwoFactorPrompt.HomeCard,
        tier: TwoFactorTier.Suggested,
      })

      const switched = reduce(shown, { type: "accountChanged", accountId: OTHER_ACCOUNT })

      expect(switched).toMatchObject({
        accountId: OTHER_ACCOUNT,
        record: null,
        start: SessionStart.Preparing,
      })
      expect(switched.impressions).toBe(shown.impressions)
    })

    it("drops a record read for an account that is no longer the one", () => {
      const preparing = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: OTHER_ACCOUNT,
      })

      expect(
        reduce(preparing, {
          type: "recordLoaded",
          accountId: ACCOUNT,
          record: recordWith(),
        }),
      ).toBe(preparing)
      expect(reduce(preparing, { type: "recordUnreadable", accountId: ACCOUNT })).toBe(
        preparing,
      )
    })

    /** A record that could not be read leaves nothing to start and nothing to write. */
    it("takes the start with no record when the record cannot be read", () => {
      const state = reduce(
        INITIAL_SESSION_STATE,
        { type: "accountChanged", accountId: ACCOUNT },
        { type: "recordUnreadable", accountId: ACCOUNT },
      )

      expect(state).toMatchObject({ record: null, start: SessionStart.Taken })
      expect(state.outbox).toEqual([])
    })

    it("takes an owed start, and only an owed one", () => {
      const taken = reduce(startedWith(recordWith()), { type: "sessionStartTaken" })
      expect(taken.start).toBe(SessionStart.Taken)
      expect(reduce(taken, { type: "sessionStartTaken" })).toBe(taken)

      const preparing = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: ACCOUNT,
      })
      expect(reduce(preparing, { type: "sessionStartTaken" })).toBe(preparing)
    })
  })

  describe("tier raises", () => {
    it("raises the tier, seeds the highs with the balance and writes the record", () => {
      const state = reduce(
        startedWith(recordWith({ highestTier: TwoFactorTier.Suggested })),
        {
          type: "tierReached",
          accountId: ACCOUNT,
          tier: TwoFactorTier.Enforced,
          crossing: SATS_CROSSING,
          wallets: walletsWith(5_000_000, 0),
        },
      )

      const raised = recordWith({
        highestTier: TwoFactorTier.Enforced,
        enforcedThreshold: 5_000_000,
        highestSats: 5_000_000,
        lastSessionSats: 5_000_000,
      })
      expect(state.record).toEqual(raised)
      expect(state.outbox).toEqual([{ kind: "save", accountId: ACCOUNT, record: raised }])
    })

    it("raises nothing the record already holds, nor another account's", () => {
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Recommended }))
      const raise = {
        type: "tierReached",
        tier: TwoFactorTier.Recommended,
        crossing: SATS_CROSSING,
        wallets: walletsWith(500_000, 0),
      } as const

      expect(reduce(started, { ...raise, accountId: ACCOUNT })).toBe(started)
      expect(
        reduce(started, {
          ...raise,
          accountId: OTHER_ACCOUNT,
          tier: TwoFactorTier.Enforced,
        }),
      ).toBe(started)
    })
  })

  describe("the highs at a session start", () => {
    type HighsReadAt = { tier: TwoFactorTier; sats: number; accountId?: string }
    const highsRead = ({
      tier,
      sats,
      accountId = ACCOUNT,
    }: HighsReadAt): SessionAction => ({
      type: "highsRead",
      accountId,
      tier,
      unmetTier: tier,
      wallets: walletsWith(sats, 0),
    })

    it("reads them once a session, keeping a new high pending at the recommended tier", () => {
      const started = startedWith(
        recordWith({
          highestTier: TwoFactorTier.Recommended,
          highestSats: 800_000,
          lastSessionSats: 800_000,
        }),
      )

      const read = reduce(
        started,
        highsRead({ tier: TwoFactorTier.Recommended, sats: 900_000 }),
      )

      expect(read.isAllTimeHighRead).toBe(true)
      expect(read.record).toMatchObject({
        highestSats: 900_000,
        lastSessionSats: 900_000,
        isNewHighPending: true,
      })
      expect(read.outbox).toHaveLength(1)
      expect(
        reduce(read, highsRead({ tier: TwoFactorTier.Recommended, sats: 950_000 })),
      ).toBe(read)
    })

    it("marks them read without a write when nothing moved", () => {
      const started = startedWith(
        recordWith({
          highestTier: TwoFactorTier.Recommended,
          highestSats: 800_000,
          lastSessionSats: 700_000,
        }),
      )

      const read = reduce(
        started,
        highsRead({ tier: TwoFactorTier.Recommended, sats: 700_000 }),
      )

      expect(read.isAllTimeHighRead).toBe(true)
      expect(read.record).toBe(started.record)
      expect(read.outbox).toEqual([])
    })

    /** Above the recommended tier the bulletin never comes back. */
    it("keeps no highs above the recommended tier", () => {
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Enforced }))

      const read = reduce(
        started,
        highsRead({ tier: TwoFactorTier.Enforced, sats: 9_000_000 }),
      )

      expect(read.isAllTimeHighRead).toBe(true)
      expect(read.outbox).toEqual([])
    })

    it("reads nothing before the record is in, nor for another account", () => {
      const preparing = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: ACCOUNT,
      })
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Recommended }))

      expect(
        reduce(preparing, highsRead({ tier: TwoFactorTier.Recommended, sats: 900_000 })),
      ).toBe(preparing)
      expect(
        reduce(
          started,
          highsRead({
            tier: TwoFactorTier.Recommended,
            sats: 900_000,
            accountId: OTHER_ACCOUNT,
          }),
        ),
      ).toBe(started)
    })
  })

  describe("dismissals", () => {
    const recommendedRecord = recordWith({ highestTier: TwoFactorTier.Recommended })

    it("counts one, takes the start, writes it and reports it with its reason", () => {
      const state = reduce(
        startedWith(recommendedRecord),
        dismissal(TwoFactorTier.Recommended),
      )

      expect(state).toMatchObject({
        start: SessionStart.Taken,
        countedTier: TwoFactorTier.Recommended,
      })
      expect(state.record?.recommendedDismissals).toBe(1)
      expect(state.outbox).toEqual([
        { kind: "save", accountId: ACCOUNT, record: state.record },
        {
          kind: "promptDismissed",
          event: {
            tier: TwoFactorTier.Recommended,
            prompt: TwoFactorPrompt.ReminderBulletin,
            reason: TwoFactorReminderReason.FirstSessions,
          },
        },
      ])
    })

    it("counts the tier once a session, however many presses land", () => {
      const state = reduce(
        startedWith(recommendedRecord),
        dismissal(TwoFactorTier.Recommended),
        dismissal(TwoFactorTier.Recommended),
      )

      expect(state.record?.recommendedDismissals).toBe(1)
      expect(state.outbox).toHaveLength(2)
    })

    /** The Settings banner is no prompt of the session start: a setup opened from it
     *  and closed spends nothing and leaves the start owed, so the modal still shows. */
    it("ignores a dismissal of a setup opened from the Settings banner", () => {
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Enforced }))

      const state = reduce(
        started,
        dismissal(
          TwoFactorTier.Enforced,
          { sessionPrompt: TwoFactorSessionPrompt.SessionModal },
          { prompt: TwoFactorPrompt.SettingsBanner },
        ),
      )

      expect(state).toBe(started)
    })

    it("ignores a dismissal of no tier, before the record is in, or of a start that blocks", () => {
      const started = startedWith(recommendedRecord)
      const preparing = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: ACCOUNT,
      })

      expect(reduce(started, dismissal(TwoFactorTier.None))).toBe(started)
      expect(reduce(preparing, dismissal(TwoFactorTier.Recommended))).toBe(preparing)
      expect(
        reduce(
          started,
          dismissal(TwoFactorTier.Enforced, {
            sessionPrompt: TwoFactorSessionPrompt.ProtectionRequired,
          }),
        ),
      ).toBe(started)
    })

    it("takes the start without counting at the suggested tier", () => {
      const state = reduce(
        startedWith(recordWith({ highestTier: TwoFactorTier.Suggested })),
        dismissal(TwoFactorTier.Suggested),
      )

      expect(state.start).toBe(SessionStart.Taken)
      expect(state.countedTier).toBe(TwoFactorTier.None)
      expect(state.outbox).toEqual([])
    })

    it("counts without spending a tier the record does not hold", () => {
      const state = reduce(
        startedWith(recordWith()),
        dismissal(TwoFactorTier.Recommended),
      )

      expect(state.countedTier).toBe(TwoFactorTier.Recommended)
      expect(state.record?.recommendedDismissals).toBe(0)
      expect(state.outbox.map(({ kind }) => kind)).toEqual(["promptDismissed"])
    })

    it("counts without reporting a dismissal that names no prompt", () => {
      const state = reduce(startedWith(recommendedRecord), {
        type: "dismissalRegistered",
        accountId: ACCOUNT,
        promptTier: TwoFactorTier.Recommended,
        read: DECIDED_READ,
      })

      expect(state.record?.recommendedDismissals).toBe(1)
      expect(state.outbox.map(({ kind }) => kind)).toEqual(["save"])
    })

    it("keeps a dismissal made while the read is out, and judges it once it lands", () => {
      const kept = reduce(
        startedWith(recommendedRecord),
        dismissal(TwoFactorTier.Recommended, { isAwaitingFreshRead: true }),
      )
      expect(kept).toMatchObject({
        start: SessionStart.Owed,
        dismissedTier: TwoFactorTier.Recommended,
      })

      const covered = reduce(kept, {
        type: "dismissalJudged",
        accountId: ACCOUNT,
        unmetTier: TwoFactorTier.Recommended,
      })
      expect(covered).toMatchObject({
        start: SessionStart.Taken,
        dismissedTier: TwoFactorTier.None,
      })

      const escalated = reduce(kept, {
        type: "dismissalJudged",
        accountId: ACCOUNT,
        unmetTier: TwoFactorTier.Enforced,
      })
      expect(escalated).toMatchObject({
        start: SessionStart.Owed,
        dismissedTier: TwoFactorTier.None,
      })
    })

    /** A prompt the start has not decided on was never up: its dismissal must not take
     *  the start the decision may still owe to the blocking screen. */
    it("keeps nothing from a dismissal made before the start was decided", () => {
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Enforced }))

      const state = reduce(
        started,
        dismissal(TwoFactorTier.Enforced, {
          isAwaitingFreshRead: true,
          isSessionStartDecided: false,
        }),
      )

      expect(state.start).toBe(SessionStart.Owed)
      expect(state.dismissedTier).toBe(TwoFactorTier.None)
    })

    /** The modal stays dismissible while leaving custody is off: it spends nothing of
     *  the allowance that leads to the blocking screen. */
    it("spends no high-balance dismissal while leaving custody is known to be off", () => {
      const started = startedWith(recordWith({ highestTier: TwoFactorTier.Enforced }))

      const state = reduce(
        started,
        dismissal(
          TwoFactorTier.Enforced,
          {
            sessionPrompt: TwoFactorSessionPrompt.SessionModal,
            isCustodyExitOff: true,
          },
          { prompt: TwoFactorPrompt.SessionModal },
        ),
      )

      expect(state.start).toBe(SessionStart.Taken)
      expect(state.record?.enforcedDismissals).toBe(0)
      expect(state.outbox.map(({ kind }) => kind)).toEqual(["promptDismissed"])
    })

    it("judges nothing without a kept dismissal, nor for another account", () => {
      const started = startedWith(recommendedRecord)
      const judged = {
        type: "dismissalJudged",
        unmetTier: TwoFactorTier.Recommended,
      } as const

      expect(reduce(started, { ...judged, accountId: ACCOUNT })).toBe(started)
      const kept = reduce(
        started,
        dismissal(TwoFactorTier.Recommended, { isAwaitingFreshRead: true }),
      )
      expect(reduce(kept, { ...judged, accountId: OTHER_ACCOUNT })).toBe(kept)
    })

    it("keeps a start a fresher read made owe a higher tier", () => {
      const state = reduce(
        startedWith(recordWith({ highestTier: TwoFactorTier.Enforced })),
        dismissal(TwoFactorTier.Recommended, { unmetTier: TwoFactorTier.Enforced }),
      )

      expect(state.start).toBe(SessionStart.Owed)
      expect(state.countedTier).toBe(TwoFactorTier.Recommended)
    })

    it("leaves the state alone for a dismissal that neither counts, takes nor waits", () => {
      const counted = reduce(
        startedWith(recommendedRecord),
        dismissal(TwoFactorTier.Recommended),
      )

      expect(reduce(counted, dismissal(TwoFactorTier.Recommended))).toBe(counted)
    })
  })

  describe("the nudge card", () => {
    const close = (accountId = ACCOUNT): SessionAction => ({
      type: "nudgeCardDismissed",
      accountId,
      tier: TwoFactorTier.Suggested,
    })

    it("closes for good at a tier the record holds, writing and reporting it", () => {
      const state = reduce(
        startedWith(recordWith({ highestTier: TwoFactorTier.Suggested })),
        close(),
      )

      expect(state.record?.nudgeCardDismissed).toBe(true)
      expect(state.outbox.map(({ kind }) => kind)).toEqual(["save", "promptDismissed"])
    })

    it("closes for the session at a tier the record does not hold", () => {
      const state = reduce(startedWith(recordWith()), close())

      expect(state.isNudgeCardHidden).toBe(true)
      expect(state.outbox.map(({ kind }) => kind)).toEqual(["promptDismissed"])
    })

    it("closes nothing more once closed, nor for an account with no session", () => {
      const closed = reduce(startedWith(recordWith()), close())
      const preparing = reduce(INITIAL_SESSION_STATE, {
        type: "accountChanged",
        accountId: ACCOUNT,
      })

      expect(reduce(closed, close())).toBe(closed)
      expect(reduce(preparing, close())).toBe(preparing)
    })
  })

  describe("impressions", () => {
    type ShownAt = {
      tier: TwoFactorTier
      accountId?: string
      reason?: TwoFactorReminderReason
    }
    const shown = ({ tier, accountId = ACCOUNT, reason }: ShownAt): SessionAction => ({
      type: "promptShown",
      accountId,
      prompt: TwoFactorPrompt.ReminderBulletin,
      tier,
      reason,
    })

    it("reports a prompt once per tier, with its reason", () => {
      const state = reduce(
        INITIAL_SESSION_STATE,
        shown({
          tier: TwoFactorTier.Recommended,
          reason: TwoFactorReminderReason.NewAllTimeHigh,
        }),
        shown({ tier: TwoFactorTier.Recommended }),
        shown({ tier: TwoFactorTier.Enforced }),
      )

      expect(state.outbox).toEqual([
        {
          kind: "promptShown",
          event: {
            tier: TwoFactorTier.Recommended,
            prompt: TwoFactorPrompt.ReminderBulletin,
            reason: TwoFactorReminderReason.NewAllTimeHigh,
          },
        },
        {
          kind: "promptShown",
          event: {
            tier: TwoFactorTier.Enforced,
            prompt: TwoFactorPrompt.ReminderBulletin,
            reason: undefined,
          },
        },
      ])
    })

    it("reports again for another account, and after a reset", () => {
      const once = reduce(
        INITIAL_SESSION_STATE,
        shown({ tier: TwoFactorTier.Recommended }),
      )

      expect(
        reduce(once, shown({ tier: TwoFactorTier.Recommended, accountId: OTHER_ACCOUNT }))
          .outbox,
      ).toHaveLength(2)
      expect(
        reduce(
          once,
          { type: "impressionsReset" },
          shown({ tier: TwoFactorTier.Recommended }),
        ).outbox,
      ).toHaveLength(2)
    })
  })

  it("drains the effects it carried out, keeping any made since", () => {
    const state = reduce(
      INITIAL_SESSION_STATE,
      {
        type: "promptShown",
        accountId: ACCOUNT,
        prompt: TwoFactorPrompt.HomeCard,
        tier: TwoFactorTier.Suggested,
      },
      {
        type: "promptShown",
        accountId: ACCOUNT,
        prompt: TwoFactorPrompt.SettingsBanner,
        tier: TwoFactorTier.Suggested,
      },
    )

    const drained = reduce(state, { type: "outboxDrained", count: 1 })

    expect(drained.outbox).toEqual([state.outbox[1]])
  })
})
