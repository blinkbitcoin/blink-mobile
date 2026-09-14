import { WalletCurrency } from "@app/graphql/generated"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"
import {
  getTxLastSeenIds,
  withTxLastSeenId,
} from "@app/store/persistent-state/tx-last-seen"
import { DefaultAccountId } from "@app/types/wallet"

const SELF_CUSTODIAL_ID = "self-custodial-account"
const OTHER_SELF_CUSTODIAL_ID = "other-self-custodial-account"

const stateForAccount = (activeAccountId?: string) => ({
  ...defaultPersistentState,
  activeAccountId,
})

describe("getTxLastSeenIds", () => {
  it("returns empty ids when nothing was ever seen", () => {
    expect(getTxLastSeenIds(stateForAccount(SELF_CUSTODIAL_ID))).toEqual({
      btcId: "",
      usdId: "",
    })
  })

  it("returns the same object identity so consumers can memoize on it", () => {
    const state = stateForAccount(SELF_CUSTODIAL_ID)

    expect(getTxLastSeenIds(state)).toBe(getTxLastSeenIds(state))
  })

  it("reads the entry stored for the active account", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "usd-1" },
      },
    }

    expect(getTxLastSeenIds(state)).toEqual({ btcId: "btc-1", usdId: "usd-1" })
  })

  it("does not read another account's entry", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [OTHER_SELF_CUSTODIAL_ID]: { btcId: "btc-other", usdId: "usd-other" },
      },
    }

    expect(getTxLastSeenIds(state)).toEqual({ btcId: "", usdId: "" })
  })

  it("falls back to the custodial key when no account is active", () => {
    const state = {
      ...stateForAccount(undefined),
      txLastSeenByAccountId: {
        [DefaultAccountId.Custodial]: { btcId: "btc-custodial", usdId: "" },
      },
    }

    expect(getTxLastSeenIds(state)).toEqual({ btcId: "btc-custodial", usdId: "" })
  })
})

describe("withTxLastSeenId", () => {
  it("stores a btc id under the active account", () => {
    const next = withTxLastSeenId(
      stateForAccount(SELF_CUSTODIAL_ID),
      WalletCurrency.Btc,
      "btc-1",
    )

    expect(next.txLastSeenByAccountId).toEqual({
      [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "" },
    })
  })

  it("stores a usd id without disturbing the btc id", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "" },
      },
    }

    const next = withTxLastSeenId(state, WalletCurrency.Usd, "usd-1")

    expect(next.txLastSeenByAccountId).toEqual({
      [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "usd-1" },
    })
  })

  it("replaces the btc id without disturbing the usd id", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "usd-1" },
      },
    }

    const next = withTxLastSeenId(state, WalletCurrency.Btc, "btc-2")

    expect(next.txLastSeenByAccountId).toEqual({
      [SELF_CUSTODIAL_ID]: { btcId: "btc-2", usdId: "usd-1" },
    })
  })

  it("keeps other accounts' entries", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [OTHER_SELF_CUSTODIAL_ID]: { btcId: "btc-other", usdId: "usd-other" },
      },
    }

    const next = withTxLastSeenId(state, WalletCurrency.Btc, "btc-1")

    expect(next.txLastSeenByAccountId).toEqual({
      [OTHER_SELF_CUSTODIAL_ID]: { btcId: "btc-other", usdId: "usd-other" },
      [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "" },
    })
  })

  it("writes under the custodial key when no account is active", () => {
    const next = withTxLastSeenId(stateForAccount(undefined), WalletCurrency.Btc, "btc-1")

    expect(next.txLastSeenByAccountId).toEqual({
      [DefaultAccountId.Custodial]: { btcId: "btc-1", usdId: "" },
    })
  })

  it("returns the same state for an empty id", () => {
    const state = stateForAccount(SELF_CUSTODIAL_ID)

    expect(withTxLastSeenId(state, WalletCurrency.Btc, "")).toBe(state)
  })

  it("returns the same state when the btc id is already stored", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "usd-1" },
      },
    }

    expect(withTxLastSeenId(state, WalletCurrency.Btc, "btc-1")).toBe(state)
  })

  it("returns the same state when the usd id is already stored", () => {
    const state = {
      ...stateForAccount(SELF_CUSTODIAL_ID),
      txLastSeenByAccountId: {
        [SELF_CUSTODIAL_ID]: { btcId: "btc-1", usdId: "usd-1" },
      },
    }

    expect(withTxLastSeenId(state, WalletCurrency.Usd, "usd-1")).toBe(state)
  })
})
