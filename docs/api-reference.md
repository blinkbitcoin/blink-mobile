# API Reference

## Project: blink-mobile (GaloyApp)

**Generated:** 2025-12-12
**API Type:** GraphQL
**Schema Source:** https://api.staging.blink.sv/graphql

## Overview

The app communicates with the Blink backend via GraphQL. All types and hooks are auto-generated in `app/graphql/generated.ts`.

- **192 Query hooks** for data fetching
- **50 Mutation hooks** for data modifications
- **1 Subscription hook** for real-time updates

## Key GraphQL Types

### Account
```typescript
type Account = {
  id: ID
  btcWallet?: BtcWallet
  usdWallet?: UsdWallet
  defaultWallet: PublicWallet
  displayCurrency: DisplayCurrency
  level: AccountLevel  // ZERO | ONE | TWO | THREE
  limits: AccountLimits
  notificationSettings: NotificationSettings
  transactions?: TransactionConnection
  pendingIncomingTransactions: Transaction[]
  wallets: Wallet[]
}
```

### Wallet
```typescript
type Wallet = BtcWallet | UsdWallet

type BtcWallet = {
  id: WalletId
  walletCurrency: "BTC"
  balance: SignedAmount
  pendingIncomingBalance: SignedAmount
  transactions?: TransactionConnection
}

type UsdWallet = {
  id: WalletId
  walletCurrency: "USD"
  balance: SignedAmount
  pendingIncomingBalance: SignedAmount
  transactions?: TransactionConnection
}
```

### Transaction
```typescript
type Transaction = {
  id: ID
  status: TxStatus  // PENDING | SUCCESS | FAILURE
  direction: TxDirection  // SEND | RECEIVE
  memo?: Memo
  createdAt: Timestamp
  settlementAmount: SignedAmount
  settlementFee: SignedAmount
  settlementDisplayAmount: SignedDisplayMajorAmount
  settlementCurrency: WalletCurrency
  settlementPrice: PriceOfOneSatInMinorUnit
  initiationVia: InitiationVia
  settlementVia: SettlementVia
}
```

## Custom Scalars

| Scalar | TypeScript | Description |
|--------|------------|-------------|
| `SatAmount` | `number` | Positive satoshi amount |
| `CentAmount` | `number` | Positive cent amount (1/100 USD) |
| `SignedAmount` | `number` | Amount that can be negative |
| `WalletId` | `string` | Unique wallet identifier |
| `OnChainAddress` | `string` | Bitcoin address |
| `LnPaymentRequest` | `string` | BOLT11 invoice |
| `PaymentHash` | `string` | Lightning payment hash |
| `Phone` | `string` | Phone with country code |
| `EmailAddress` | `string` | Email address |
| `Username` | `string` | Blink username |
| `Timestamp` | `number` | Unix timestamp |
| `AuthToken` | `string` | Bearer token |

## Key Queries

### Wallet & Balance
```typescript
// Get wallet overview
useWalletOverviewScreenQuery()

// Get real-time price
useRealtimePriceQuery({ pollInterval: 300000 })

// Get transaction history
useTransactionsQuery({
  variables: {
    first: 20,
    after: cursor,
    walletIds: [walletId]
  }
})
```

### User & Account
```typescript
// Get user ID
useMyUserIdQuery()

// Get account level
useLevelQuery()

// Get analytics data
useAnalyticsQuery()
```

### Contacts
```typescript
// Search by username
useUserDefaultWalletIdQuery({
  variables: { username }
})

// Get contact list
useContactsQuery()
```

### Price & Currency
```typescript
// Bitcoin price list (for charts)
useBtcPriceListQuery({
  variables: { range: "ONE_DAY" }
})

// Currency list
useCurrencyListQuery()
```

## Key Mutations

### Lightning Payments
```typescript
// Create invoice
useLnInvoiceCreateMutation({
  variables: {
    input: {
      walletId,
      amount,
      memo
    }
  }
})

// Pay invoice
useLnInvoicePaymentSendMutation({
  variables: {
    input: {
      walletId,
      paymentRequest,
      memo
    }
  }
})

// No-amount invoice
useLnNoAmountInvoicePaymentSendMutation({
  variables: {
    input: {
      walletId,
      paymentRequest,
      amount,
      memo
    }
  }
})
```

### On-Chain Transactions
```typescript
// Get on-chain address
useOnChainAddressCreateMutation({
  variables: {
    input: { walletId }
  }
})

// Send on-chain
useOnChainPaymentSendMutation({
  variables: {
    input: {
      walletId,
      address,
      amount,
      memo
    }
  }
})

// Estimate fee
useOnChainTxFeeMutation({
  variables: {
    walletId,
    address,
    amount
  }
})
```

### Intra-Ledger (Internal)
```typescript
// Send to username
useIntraLedgerPaymentSendMutation({
  variables: {
    input: {
      walletId,
      recipientWalletId,
      amount,
      memo
    }
  }
})
```

### Authentication
```typescript
// Phone login initiate
useCaptchaRequestAuthCodeMutation({
  variables: {
    input: {
      phone,
      challengeCode,
      validationCode
    }
  }
})

// Phone login validate
useUserLoginMutation({
  variables: {
    input: {
      phone,
      code
    }
  }
})

// Email registration
useUserEmailRegistrationInitiateMutation({
  variables: {
    input: { email }
  }
})

// TOTP setup
useUserTotpRegistrationInitiateMutation()
```

### Account Management
```typescript
// Update username
useUserUpdateUsernameMutation({
  variables: {
    input: { username }
  }
})

// Update language
useUserUpdateLanguageMutation({
  variables: {
    input: { language }
  }
})

// Update currency
useAccountUpdateDisplayCurrencyMutation({
  variables: {
    input: { currency }
  }
})
```

### Notifications
```typescript
// Register device token
useDeviceNotificationTokenCreateMutation({
  variables: {
    input: { deviceToken }
  }
})
```

## Error Handling

GraphQL errors are handled in `app/graphql/error-code.ts`:

```typescript
type GraphQLErrorCode =
  | "AUTHENTICATION_ERROR"
  | "FORBIDDEN_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "NOT_FOUND_ERROR"
  | "RATE_LIMIT_ERROR"
  // Payment-specific
  | "INSUFFICIENT_BALANCE"
  | "SELF_PAYMENT_ERROR"
  | "INVOICE_EXPIRED"
  | "ROUTE_NOT_FOUND"
  // etc.
```

## Apollo Client Configuration

Key features configured in `app/graphql/client.tsx`:

1. **Persisted Queries**: SHA-256 hashed queries for bandwidth optimization
2. **Cache Persistence**: Apollo cache stored in AsyncStorage
3. **Retry Logic**: Auto-retry with backoff (excludes payment operations)
4. **WebSocket**: Real-time subscriptions for price updates
5. **App Check**: Firebase device attestation header
6. **Auth**: Bearer token in Authorization header

## API Environments

| Environment | Endpoint | WebSocket |
|-------------|----------|-----------|
| Production | https://api.blink.sv/graphql | wss://ws.blink.sv/graphql |
| Staging | https://api.staging.blink.sv/graphql | wss://ws.staging.blink.sv/graphql |
| Local | http://localhost:4455/graphql | ws://localhost:4455/graphqlws |
