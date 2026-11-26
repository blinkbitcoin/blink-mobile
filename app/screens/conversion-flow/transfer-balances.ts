import { WalletCurrency } from "@app/graphql/generated"
import { CARD, CardCurrency } from "@app/types/amounts"

/** A balance the Transfer moves money between: one of the wallets, or the Card Balance. */
export type TransferBalance = WalletCurrency | CardCurrency

/** The order the Transfer offers the balances in, as Home lists them. */
export const TRANSFER_BALANCE_ORDER: readonly TransferBalance[] = [
  WalletCurrency.Btc,
  WalletCurrency.Usd,
  CARD,
]

export type TransferPair = {
  from: TransferBalance
  to: TransferBalance
}

/** The Card Balance is held in bitcoin (D83), so it moves in sats like the Bitcoin
 *  Balance. */
export const settlementCurrencyOf = (balance: TransferBalance): WalletCurrency =>
  balance === CARD ? WalletCurrency.Btc : balance

/** Every move between two balances, except from the Card Balance back to the Dollar
 *  Balance: that one waits until its rate and fee are decided. */
const isMoveOffered = ({ from, to }: TransferPair): boolean => {
  const isCardToDollar = from === CARD && to === WalletCurrency.Usd
  return from !== to && !isCardToDollar
}

type ChoicesInput = {
  /** The balances the member holds, in the order the Transfer offers them. */
  balances: readonly TransferBalance[]
  /** The destination when it is fixed, as during a top-up of the card. */
  destination?: CardCurrency
}

export const sourceChoices = ({ balances, destination }: ChoicesInput) => {
  const destinations = destination ? [destination] : balances
  return balances.filter((from) => destinations.some((to) => isMoveOffered({ from, to })))
}

export const destinationChoices = ({
  balances,
  destination,
  from,
}: ChoicesInput & { from: TransferBalance }) => {
  if (destination) return [destination]
  return balances.filter((to) => isMoveOffered({ from, to }))
}

/** The choice after `current`, wrapping around; the first when `current` is none. */
export const nextChoice = (
  choices: readonly TransferBalance[],
  current: TransferBalance,
): TransferBalance => choices[(choices.indexOf(current) + 1) % choices.length]

/** A new source keeps the destination while that move is offered, and takes the first
 *  destination it can move to otherwise. */
export const withSource = (
  pair: TransferPair,
  from: TransferBalance,
  balances: readonly TransferBalance[],
): TransferPair => {
  if (isMoveOffered({ from, to: pair.to })) return { from, to: pair.to }
  const to = balances.find((balance) => isMoveOffered({ from, to: balance })) ?? pair.from
  return { from, to }
}

export const withDestination = (
  pair: TransferPair,
  to: TransferBalance,
): TransferPair => ({ from: pair.from, to })

/** The same move the other way, when that is offered. A fixed destination never flips. */
export const flippedPair = (
  { from, to }: TransferPair,
  destination?: CardCurrency,
): TransferPair | null => {
  const flipped = { from: to, to: from }
  if (destination || !isMoveOffered(flipped)) return null
  return flipped
}

type InitialPairInput = ChoicesInput & {
  /** What each wallet holds, in its own currency's smallest unit. */
  funds: Record<WalletCurrency, number>
  isDrainConversion?: boolean
}

/**
 * The move the Transfer opens with. A top-up of the card comes from the Bitcoin Balance,
 * or from the Dollar Balance when only that one holds funds. A drain empties the Dollar
 * Balance into the Bitcoin Balance. Anything else opens from the Bitcoin Balance to the
 * first balance it can move to: the Dollar Balance, as it always has, unless it is left
 * out.
 */
export const initialTransferPair = ({
  funds,
  balances,
  destination,
  isDrainConversion = false,
}: InitialPairInput): TransferPair => {
  if (destination) {
    const isDollarOffered = balances.includes(WalletCurrency.Usd)
    const isOnlyDollarFunded =
      funds[WalletCurrency.Btc] === 0 && funds[WalletCurrency.Usd] > 0
    const isFromDollar = isDollarOffered && isOnlyDollarFunded
    const from = isFromDollar ? WalletCurrency.Usd : WalletCurrency.Btc
    return { from, to: destination }
  }
  if (isDrainConversion) return { from: WalletCurrency.Usd, to: WalletCurrency.Btc }
  const [to = WalletCurrency.Usd] = destinationChoices({
    balances,
    from: WalletCurrency.Btc,
  })
  return { from: WalletCurrency.Btc, to }
}

type PillHandlersInput<Side> = ChoicesInput & {
  pair: TransferPair
  sides: Record<TransferBalance, Side | undefined>
  isLocked: boolean
  onChange: (sides: { fromWallet: Side; toWallet: Side }) => void
}

/**
 * What the member can change on the Transfer's two sides. The pills cycle through the
 * balances when there are more than the flip covers, as with the card, or when the
 * destination is fixed (design 150).
 */
export const transferPillHandlers = <Side>({
  balances,
  destination,
  pair,
  sides,
  isLocked,
  onChange,
}: PillHandlersInput<Side>) => {
  const sources = sourceChoices({ balances, destination })
  const destinations = destinationChoices({ balances, destination, from: pair.from })
  const hasPillChoices = destination !== undefined || balances.length > 2
  const canCycleSource = hasPillChoices && sources.length > 1
  const canCycleDestination = hasPillChoices && destinations.length > 1

  const choose = (next: TransferPair) => {
    const fromWallet = sides[next.from]
    const toWallet = sides[next.to]
    if (isLocked || !fromWallet || !toWallet) return
    onChange({ fromWallet, toWallet })
  }
  const cycleSource = () =>
    choose(withSource(pair, nextChoice(sources, pair.from), balances))
  const cycleDestination = () =>
    choose(withDestination(pair, nextChoice(destinations, pair.to)))

  return {
    onSourcePillPress: canCycleSource ? cycleSource : undefined,
    onDestinationPillPress: canCycleDestination ? cycleDestination : undefined,
    isFlipOffered: flippedPair(pair, destination) !== null,
  }
}
