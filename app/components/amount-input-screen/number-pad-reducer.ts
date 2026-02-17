import { WalletCurrency } from "@app/graphql/generated"
import { CurrencyInfo } from "@app/hooks/use-display-currency"
import { WalletOrDisplayCurrency } from "@app/types/amounts"

export type NumberPadNumber = {
  majorAmount: string
  minorAmount: string
  hasDecimal: boolean
}

export type NumberPadReducerState = {
  numberPadNumber: NumberPadNumber
  numberOfDecimalsAllowed: number
  currency: WalletOrDisplayCurrency
}

export const NumberPadReducerActionType = {
  SetAmount: "SetAmount",
  HandleKeyPress: "HandleKeyPress",
  ClearAmount: "ClearAmount",
  HandlePaste: "HandlePaste",
} as const

export type NumberPadReducerAction =
  | {
      action: typeof NumberPadReducerActionType.SetAmount
      payload: {
        numberPadNumber: NumberPadNumber
        numberOfDecimalsAllowed: number
        currency: WalletOrDisplayCurrency
      }
    }
  | {
      action: typeof NumberPadReducerActionType.HandleKeyPress
      payload: {
        key: Key
      }
    }
  | {
      action: typeof NumberPadReducerActionType.ClearAmount
    }
  | {
      action: typeof NumberPadReducerActionType.HandlePaste
      payload: {
        keys: number
      }
    }

export const Key = {
  Backspace: "⌫",
  0: "0",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  Decimal: ".",
} as const

export type Key = (typeof Key)[keyof typeof Key]

export type NumberPadReducerActionType =
  (typeof NumberPadReducerActionType)[keyof typeof NumberPadReducerActionType]

export const formatNumberPadNumber = ({
  numberPadNumber,
  currency,
  currencyInfo,
  noSuffix = false,
}: {
  numberPadNumber: NumberPadNumber
  currency: WalletOrDisplayCurrency
  currencyInfo: Record<WalletOrDisplayCurrency, CurrencyInfo>
  noSuffix?: boolean
}) => {
  const { majorAmount, minorAmount, hasDecimal } = numberPadNumber
  const currencyCode =
    currency === WalletCurrency.Btc && !noSuffix
      ? currencyInfo[currency].currencyCode
      : undefined

  if (!majorAmount && !minorAmount && !hasDecimal && !currencyCode) return ""

  const major = Number(majorAmount).toLocaleString()
  const suffix = currencyCode ? ` ${currencyCode}` : ""
  return hasDecimal ? `${major}.${minorAmount}${suffix}` : `${major}${suffix}`
}

export const getDisabledKeys = ({
  numberPadNumber,
  numberOfDecimalsAllowed,
}: NumberPadReducerState): ReadonlySet<Key> => {
  const { majorAmount, minorAmount, hasDecimal } = numberPadNumber
  const keys = new Set<Key>()
  if (!majorAmount && !minorAmount && !hasDecimal) keys.add(Key.Backspace)
  if (numberOfDecimalsAllowed === 0 || hasDecimal) keys.add(Key.Decimal)
  return keys
}

export const numberPadReducer = (
  state: NumberPadReducerState,
  action: NumberPadReducerAction,
): NumberPadReducerState => {
  const {
    numberPadNumber: { majorAmount, minorAmount, hasDecimal },
    numberOfDecimalsAllowed,
  } = state

  switch (action.action) {
    case NumberPadReducerActionType.SetAmount:
      return action.payload
    case NumberPadReducerActionType.HandlePaste: {
      const num = action.payload.keys
      const formatted: string =
        num % 1 === 0 ? num.toString() : num.toFixed(numberOfDecimalsAllowed)
      const splitByDecimal = formatted.split(".")

      return {
        ...state,
        numberPadNumber: {
          majorAmount: splitByDecimal[0],
          hasDecimal: splitByDecimal.length > 1,
          minorAmount: splitByDecimal[1] ?? "",
        },
      }
    }
    case NumberPadReducerActionType.HandleKeyPress:
      if (action.payload.key === Key.Backspace) {
        if (minorAmount.length > 0) {
          return {
            ...state,
            numberPadNumber: {
              majorAmount,
              hasDecimal,
              minorAmount: minorAmount.slice(0, -1),
            },
          }
        }

        if (hasDecimal) {
          return {
            ...state,
            numberPadNumber: {
              majorAmount,
              hasDecimal: false,
              minorAmount,
            },
          }
        }

        return {
          ...state,
          numberPadNumber: {
            majorAmount: majorAmount.slice(0, -1),
            hasDecimal,
            minorAmount,
          },
        }
      }

      if (action.payload.key === Key.Decimal) {
        if (numberOfDecimalsAllowed > 0) {
          return {
            ...state,
            numberPadNumber: {
              majorAmount,
              minorAmount,
              hasDecimal: true,
            },
          }
        }
        return state
      }

      if (hasDecimal && minorAmount.length < numberOfDecimalsAllowed) {
        return {
          ...state,
          numberPadNumber: {
            majorAmount,
            hasDecimal,
            minorAmount: minorAmount + action.payload.key,
          },
        }
      }

      if (hasDecimal && minorAmount.length >= numberOfDecimalsAllowed) {
        return state
      }

      return {
        ...state,
        numberPadNumber: {
          majorAmount: majorAmount + action.payload.key,
          minorAmount,
          hasDecimal,
        },
      }
    case NumberPadReducerActionType.ClearAmount:
      return {
        ...state,
        numberPadNumber: {
          majorAmount: "",
          minorAmount: "",
          hasDecimal: false,
        },
      }

    default:
      return state
  }
}
