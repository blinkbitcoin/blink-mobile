# Blink Mobile API Contracts

## Overview

Blink Mobile communicates with the Blink backend exclusively via GraphQL. The API provides:
- Queries for reading data
- Mutations for state changes
- Subscriptions for real-time updates

## Backend Endpoints

| Environment | GraphQL HTTP | GraphQL WebSocket |
|-------------|--------------|-------------------|
| Production | `https://api.blink.sv/graphql` | `wss://ws.blink.sv/graphql` |
| Staging | `https://api.staging.blink.sv/graphql` | `wss://ws.staging.blink.sv/graphql` |
| Local | `http://localhost:4455/graphql` | `ws://localhost:4455/graphqlws` |

## Authentication

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <token>` | For authenticated requests |
| `Appcheck` | Firebase App Check token | For API protection |

### Token Management

- Tokens obtained via phone/email/TOTP authentication
- Stored securely in react-native-keychain
- 401 responses trigger retry with backoff

## Core Data Types

### Account

```graphql
type Account {
  id: ID!
  level: AccountLevel!
  defaultWallet: PublicWallet!
  defaultWalletId: WalletId! @deprecated
  displayCurrency: DisplayCurrency!
  btcWallet: BtcWallet
  usdWallet: UsdWallet
  wallets: [Wallet!]!
  walletById(walletId: WalletId!): Wallet!
  limits: AccountLimits!
  notificationSettings: NotificationSettings!
  transactions(first: Int, after: String, walletIds: [WalletId]): TransactionConnection
  pendingIncomingTransactions(walletIds: [WalletId]): [Transaction!]!
  invoices(first: Int, after: String, walletIds: [WalletId]): InvoiceConnection
  realtimePrice: RealtimePrice!
  callbackEndpoints: [CallbackEndpoint!]!
  csvTransactions(walletIds: [WalletId!]!): String!
}
```

### Account Levels

```graphql
enum AccountLevel {
  ZERO   # Unverified
  ONE    # Basic verification
  TWO    # Enhanced verification
  THREE  # Full verification
}
```

### Wallets

```graphql
type BtcWallet implements Wallet {
  id: WalletId!
  walletCurrency: WalletCurrency!
  balance: SignedAmount!
  pendingIncomingBalance: SignedAmount!
  # ... transactions, invoices
}

type UsdWallet implements Wallet {
  id: WalletId!
  walletCurrency: WalletCurrency!
  balance: SignedAmount!
  pendingIncomingBalance: SignedAmount!
  # ... transactions, invoices
}

enum WalletCurrency {
  BTC
  USD
}
```

### Transactions

```graphql
type Transaction {
  id: ID!
  initiationVia: InitiationVia!
  settlementVia: SettlementVia!
  settlementAmount: SignedAmount!
  settlementFee: SignedAmount!
  settlementDisplayAmount: SignedDisplayMajorAmount!
  settlementDisplayFee: SignedDisplayMajorAmount!
  settlementDisplayCurrency: DisplayCurrency!
  settlementPrice: PriceOfOneSatInMinorUnit!
  direction: TxDirection!
  status: TxStatus!
  memo: Memo
  createdAt: Timestamp!
}

enum TxDirection {
  SEND
  RECEIVE
}

enum TxStatus {
  FAILURE
  PENDING
  SUCCESS
}
```

## Key Queries

### User & Account

```graphql
# Get current user
query Me {
  me {
    id
    username
    language
    phone
    email {
      address
      verified
    }
    totpEnabled
    defaultAccount {
      id
      level
      wallets { id walletCurrency balance }
    }
  }
}

# Get language preference
query Language {
  me {
    language
  }
}
```

### Wallet & Transactions

```graphql
# Get wallet transactions
query TransactionListForDefaultAccount(
  $first: Int
  $after: String
) {
  me {
    defaultAccount {
      transactions(first: $first, after: $after) {
        edges {
          node { ...TransactionFields }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}

# Get realtime price
query RealtimePrice {
  me {
    defaultAccount {
      realtimePrice {
        btcSatPrice { base offset }
        usdCentPrice { base offset }
        denominatorCurrency
      }
    }
  }
}
```

### Lightning

```graphql
# Create Lightning invoice (BTC)
mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
  lnInvoiceCreate(input: $input) {
    invoice {
      paymentRequest
      paymentHash
      paymentSecret
      satoshis
    }
    errors { message code }
  }
}

# Create Lightning invoice (USD)
mutation LnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {
  lnUsdInvoiceCreate(input: $input) {
    invoice {
      paymentRequest
      paymentHash
      satoshis
    }
    errors { message code }
  }
}

# Pay Lightning invoice
mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
  lnInvoicePaymentSend(input: $input) {
    status
    errors { message code }
  }
}
```

### On-Chain

```graphql
# Get on-chain address
mutation OnChainAddressCreate($input: OnChainAddressCreateInput!) {
  onChainAddressCreate(input: $input) {
    address
    errors { message code }
  }
}

# Send on-chain payment
mutation OnChainPaymentSend($input: OnChainPaymentSendInput!) {
  onChainPaymentSend(input: $input) {
    status
    errors { message code }
  }
}

# Get on-chain fee estimate
mutation OnChainTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {
  onChainTxFee(walletId: $walletId, address: $address, amount: $amount) {
    amount
    targetConfirmations
  }
}
```

### Intraledger

```graphql
# Send to Blink user
mutation IntraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
  intraLedgerPaymentSend(input: $input) {
    status
    errors { message code }
  }
}

# Send USD to Blink user
mutation IntraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
  intraLedgerUsdPaymentSend(input: $input) {
    status
    errors { message code }
  }
}
```

## Subscriptions

### Price Updates

```graphql
subscription PriceSubscription($input: PriceInput!) {
  price(input: $input) {
    price {
      base
      offset
      currencyUnit
    }
  }
}
```

### Transaction Updates

```graphql
subscription MyUpdates {
  myUpdates {
    update {
      ... on LnUpdate {
        paymentHash
        status
        walletId
      }
      ... on OnChainUpdate {
        txHash
        status
        walletId
      }
      ... on IntraLedgerUpdate {
        txNotificationType
        walletId
      }
    }
    errors { message }
  }
}
```

## Authentication Mutations

### Phone Authentication

```graphql
# Request phone code
mutation UserPhoneCodeRequest($input: UserPhoneCodeRequestInput!) {
  userPhoneCodeRequest(input: $input) {
    success
    errors { message code }
  }
}

# Login with phone
mutation UserLogin($input: UserLoginInput!) {
  userLogin(input: $input) {
    authToken
    totpRequired
    errors { message code }
  }
}
```

### Email Authentication

```graphql
# Initiate email registration
mutation UserEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {
  userEmailRegistrationInitiate(input: $input) {
    emailRegistrationId
    errors { message code }
  }
}

# Validate email code
mutation UserEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {
  userEmailRegistrationValidate(input: $input) {
    me { id email { address verified } }
    errors { message code }
  }
}
```

### TOTP Authentication

```graphql
# Register TOTP
mutation UserTotpRegistrationInitiate($input: UserTotpRegistrationInitiateInput!) {
  userTotpRegistrationInitiate(input: $input) {
    totpRegistrationId
    totpSecret
    errors { message code }
  }
}

# Validate TOTP
mutation UserTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {
  userTotpRegistrationValidate(input: $input) {
    me { id totpEnabled }
    errors { message code }
  }
}
```

## Error Handling

### Error Response Structure

```graphql
type Error {
  message: String!
  code: String
  path: [String!]
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Invalid request parameters |
| `INSUFFICIENT_BALANCE` | Not enough funds |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `AUTHENTICATION_ERROR` | Invalid or expired token |
| `AUTHORIZATION_ERROR` | Permission denied |
| `INVOICE_EXPIRED` | Lightning invoice expired |
| `ROUTE_NOT_FOUND` | No Lightning route available |

## Apollo Client Configuration

### Retry Logic

Operations with automatic retry:
- All queries
- Most mutations

Operations WITHOUT retry (payment safety):
- `intraLedgerPaymentSend`
- `intraLedgerUsdPaymentSend`
- `lnInvoiceFeeProbe`
- `lnInvoicePaymentSend`
- `lnNoAmountInvoicePaymentSend`
- `onChainPaymentSend`
- `onChainUsdPaymentSend`

### Persisted Queries

The app uses Apollo persisted queries with SHA256 hashing for:
- Reduced bandwidth
- Query whitelisting support
- Improved security

### Cache Strategy

- **cache-first**: User data, settings
- **network-only**: Transactions, balances
- **cache-and-network**: Price data

## External Services

### KYC Service

| Environment | URL |
|-------------|-----|
| Production | `https://kyc.blink.sv` |
| Staging | `https://kyc.staging.blink.sv` |

### Point of Sale

| Environment | URL |
|-------------|-----|
| Production | `https://pay.blink.sv` |
| Staging | `https://pay.staging.blink.sv` |

### Block Explorer

- Mainnet: `https://mempool.space/tx/`
- Signet (Staging): `https://mempool.space/signet/tx/`

## Code Generation

GraphQL types and hooks are auto-generated:

```bash
yarn dev:codegen
```

Configuration in `codegen.yml`:
- Schema: `https://api.staging.blink.sv/graphql`
- Output: `app/graphql/generated.ts`
- Plugins: typescript, typescript-operations, typescript-react-apollo

---

*Generated by BMAD Document Project Workflow*
