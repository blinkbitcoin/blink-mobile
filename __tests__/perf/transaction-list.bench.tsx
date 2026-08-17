/**
 * Benchmark harness for issue #4137.
 *
 * Renders N real TransactionItem rows inside a real NavigationContainer, then
 * navigates to a second screen — which is what pushing the transaction detail
 * screen does — and measures what that costs the list behind it.
 *
 * Nothing about the measured paths is mocked: the focus subscription is the
 * real useIsFocused, the styles go through the real makeStyles, and the amounts
 * go through the real useDisplayCurrency. Only IconTransaction is stubbed, and
 * only so it can count how many times each row renders.
 *
 * Run against origin/main for "before" and this branch for "after".
 *
 * This is a manual A/B harness, not a test: it lives under __tests__/ but
 * testRegex in jest.config.js only matches .(test|spec).(ts|tsx|js), so
 * .bench.tsx never runs in CI. Nothing will tell you when it rots — re-run it
 * by name whenever the row or the list changes.
 */
import React from "react"
import { StyleSheet } from "react-native"
import { act, render, waitFor } from "@testing-library/react-native"
import { MockedProvider } from "@apollo/client/testing"
import { NavigationContainer, useNavigation } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import mocks from "@app/graphql/mocks"
import theme from "@app/rne-theme/theme"
import TypesafeI18n from "@app/i18n/i18n-react"
import { detectDefaultLocale } from "@app/utils/locale-detector"
import { TransactionFragmentDoc } from "@app/graphql/generated"
import { MemoizedTransactionItem } from "@app/components/transaction-item"

import { flushEffects } from "../helpers/flush-effects"

import { createCache } from "../../app/graphql/cache"
import { IsAuthedContextProvider } from "../../app/graphql/is-authed-context"
import { PersistentStateContext } from "../../app/store/persistent-state"
import { AccountRegistryProvider } from "../../app/hooks/use-account-registry"

// Counts renders per row without touching any measured code path.
type BenchGlobal = { __rowRendered: () => void; __navigate: () => void }
const benchGlobal = global as unknown as BenchGlobal

let rowRenders = 0
jest.mock("@app/components/icon-transactions", () => ({
  IconTransaction: () => {
    ;(global as unknown as { __rowRendered: () => void }).__rowRendered()
    return null
  },
}))

benchGlobal.__rowRendered = () => {
  rowRenders += 1
}

const ROW_COUNT = Number(process.env.BENCH_ROWS ?? 200)
const REPEATS = Number(process.env.BENCH_REPEATS ?? 5)

const makeTx = (index: number) => ({
  __typename: "Transaction" as const,
  id: `tx-${index}`,
  status: "SUCCESS",
  direction: index % 2 === 0 ? "SEND" : "RECEIVE",
  memo: `payment ${index}`,
  createdAt: 1700000000 + index,
  settlementAmount: 1000 + index,
  settlementFee: 1,
  settlementDisplayFee: "0.01",
  settlementCurrency: "BTC",
  settlementDisplayAmount: `${index}.75`,
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit" as const,
    base: 1,
    offset: 0,
    currencyUnit: "USDCENT",
    formattedAmount: "1",
  },
  initiationVia: { __typename: "InitiationViaLn" as const, paymentHash: `hash-${index}` },
  settlementVia: { __typename: "SettlementViaLn" as const, preImage: `pre-${index}` },
})

const Stack = createNativeStackNavigator()

const ListScreen: React.FC = () => {
  const navigation = useNavigation()

  // In an effect, not the render body: assigning during render is the pattern
  // a double-rendering mode punishes, and it would silently skew the counts.
  React.useEffect(() => {
    benchGlobal.__navigate = () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation as any).navigate("Detail")
  }, [navigation])

  return (
    <>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <MemoizedTransactionItem
          key={`tx-${index}`}
          txid={`tx-${index}`}
          subtitle
          highlight={index === 0}
        />
      ))}
    </>
  )
}

const DetailScreen: React.FC = () => null

const Harness: React.FC = () => {
  const cache = React.useMemo(() => {
    const created = createCache()
    Array.from({ length: ROW_COUNT }, (_, index) => {
      created.writeFragment({
        fragment: TransactionFragmentDoc,
        fragmentName: "Transaction",
        id: `Transaction:tx-${index}`,
        data: makeTx(index),
      })
      return null
    })
    return created
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <MockedProvider mocks={mocks} cache={cache}>
        <PersistentStateContext.Provider
          value={{
            persistentState: {
              schemaVersion: 15,
              galoyInstance: { id: "Main" },
              galoyAuthToken: "",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            updateState: () => {},
            resetState: () => {},
            clearToken: async () => {},
          }}
        >
          <TypesafeI18n locale={detectDefaultLocale()}>
            <IsAuthedContextProvider value={true}>
              <AccountRegistryProvider>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="List" component={ListScreen} />
                    <Stack.Screen name="Detail" component={DetailScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
              </AccountRegistryProvider>
            </IsAuthedContextProvider>
          </TypesafeI18n>
        </PersistentStateContext.Provider>
      </MockedProvider>
    </ThemeProvider>
  )
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Mount is asynchronous: the currency list, i18n and the Apollo fragments all
// settle over several ticks. Without waiting for the row-render count to stop
// moving, late mount renders get counted against the navigation that follows
// and the measurement is worthless.
const readRowRenders = () => rowRenders

// One quiet pass is enough to call it settled; the cap only exists so a tree
// that never stops rendering fails loudly instead of hanging until the timeout.
const SETTLE_MAX_PASSES = 100

const settle = async () => {
  for (let pass = 0; pass < SETTLE_MAX_PASSES; pass += 1) {
    const before = readRowRenders()
    // eslint-disable-next-line no-await-in-loop
    await flushEffects()
    if (readRowRenders() === before) {
      return
    }
  }
  throw new Error(
    `tree never became quiescent after ${SETTLE_MAX_PASSES} passes, so the measurement would be meaningless`,
  )
}

// Long enough for the largest BENCH_ROWS x BENCH_REPEATS combination in use.
jest.setTimeout(300000)

describe(`transaction list — ${ROW_COUNT} rows`, () => {
  it("measures the cost of opening a transaction", async () => {
    const mountRowRenders: number[] = []
    const mountStyleSheets: number[] = []
    const mountFormatters: number[] = []
    const openRowRenders: number[] = []

    for (let run = 0; run < REPEATS; run += 1) {
      const styleSheetSpy = jest.spyOn(StyleSheet, "create")
      const formatterSpy = jest.spyOn(Intl, "NumberFormat")
      rowRenders = 0

      const screen = render(<Harness />)
      // eslint-disable-next-line no-loop-func
      await waitFor(() => {
        expect(readRowRenders()).toBeGreaterThanOrEqual(ROW_COUNT)
      })
      await settle()

      mountRowRenders.push(rowRenders)
      mountStyleSheets.push(styleSheetSpy.mock.calls.length)
      mountFormatters.push(formatterSpy.mock.calls.length)

      // Opening a transaction: push the detail screen, which flips focus on the
      // list behind it. This is the moment the issue is about.
      rowRenders = 0
      await act(async () => {
        benchGlobal.__navigate()
      })
      await settle()
      openRowRenders.push(rowRenders)

      styleSheetSpy.mockRestore()
      formatterSpy.mockRestore()
      screen.unmount()
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          rows: ROW_COUNT,
          repeats: REPEATS,
          mount: {
            rowRenders: median(mountRowRenders),
            styleSheetCreates: median(mountStyleSheets),
            // The formatter cache is module-level, so it survives the whole
            // REPEATS loop: only the first run measures a cold cache, and runs
            // 2+ reporting 0 is the expected shape of the fix rather than a
            // per-mount number. A median across runs would describe the loop.
            intlNumberFormatsFirstRun: mountFormatters[0],
            intlNumberFormatsEachRun: mountFormatters,
          },
          // Wall-clock is deliberately not reported: in this environment it is
          // dominated by warm-up noise (400 rows repeatedly timed faster than
          // 200). The render counts are exact and environment-independent.
          openTransaction: {
            rowRendersEachRun: openRowRenders,
            rowRenders: median(openRowRenders),
          },
        },
        null,
        2,
      ),
    )
  })
})
