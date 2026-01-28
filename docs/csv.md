# Blink CSV Export Field Explanations

    `CSV_EXPORT_FIELDS`

## Transaction History CSV Export - Field Explanations

This guide explains the fields you'll find when exporting your transaction history as a CSV file from Blink. The Full Export from Blink contains **24 fields** with complete transaction details.

## Full Export Fields (24 Columns)

### Transaction Identification

| Field | What It Means |
|------|---------------|
| `id` | A unique identifier for this specific transaction. Like a receipt number - no two transactions have the same ID. |
| `walletId` | The unique identifier of your wallet that was used for this transaction. You may have two wallets: a BTC (Bitcoin) wallet and a USD (Stablesats) wallet. |
| `journalId` | An internal accounting reference used by Blink's ledger system. You can ignore this for personal record-keeping. |

### Transaction Type & Direction

| Field | What It Means |
|------|---------------|
| `type` | How the payment was categorized. See the detailed breakdown below. |
| `credit` | The amount you **received** (money coming IN). Shows the amount in satoshis for BTC or cents for USD. If this was a payment you sent, this will be 0. |
| `debit` | The amount you **sent** (money going OUT). Shows the amount in satoshis for BTC or cents for USD. If this was a payment you received, this will be 0. |
| `fee` | The network or service fee charged for this transaction (in satoshis or cents). Usually empty or 0 for received payments. |

### Currency & Timing

| Field | What It Means |
|------|---------------|
| `currency` | Which wallet the transaction came from: `BTC` for your Bitcoin wallet or `USD` for your Stablesats (dollar-pegged) wallet. |
| `timestamp` | The exact date and time when the transaction happened, shown in a readable format (e.g., "Wed Dec 10 2025 23:17:28 GMT+0000"). |
| `pendingConfirmation` | Whether the transaction is still waiting to be confirmed. `true` means it's still processing, `false` means it's complete. |

### Memos & Notes

| Field | What It Means |
|------|---------------|
| `lnMemo` | A note attached to Lightning invoices. This is what you see when creating a payment request (e.g., "Coffee order #42"). |
| `memoFromPayer` | A note that the sender included when making the payment. Only visible for received payments where the sender added a message. |

### Value in Your Display Currency

| Field | What It Means |
|------|---------------|
| `displayAmount` | The transaction amount converted to your display currency (e.g., USD). This shows you what the Bitcoin was worth at the time of the transaction. For example, if you received 7685 sats and it shows 709 in displayAmount with USD as displayCurrency, you received about $7.09 worth of Bitcoin. |
| `displayFee` | The fee converted to your display currency. Shows what the fee was worth in dollars (or your chosen currency) at the time. |
| `displayCurrency` | What currency the displayAmount and displayFee are shown in (e.g., `USD`, `TZS` for Tanzanian Shillings, etc.). This is your account's preferred display currency. |

### USD Equivalents

| Field | What It Means |
|------|---------------|
| `usd` | The USD equivalent of the transaction at the time it occurred. May be empty for some transaction types. |
| `feeUsd` | The fee amount expressed in USD. May be empty for some transaction types. |

### Counterparty Information

| Field | What It Means |
|------|---------------|
| `recipientWalletId` | For payments you sent: the wallet ID of the person who received the payment. Empty for received payments. |
| `username` | The Blink username of the other person in the transaction. For sent payments, this shows who you paid. Only appears for transactions between Blink users. |

### Payment Technical Details

| Field | What It Means |
|------|---------------|
| `paymentHash` | A unique code that identifies a Lightning payment. This is cryptographic proof that a specific payment was made. Useful for resolving disputes or tracking payments. |
| `pubkey` | The public key of the Lightning node involved in the transaction. This is a technical identifier for the sender's or receiver's Lightning node. |
| `feeKnownInAdvance` | Whether the exact fee was known before the payment was made. `true` means the fee was fixed, `false` means it was estimated. |

### On-Chain Transaction Details

| Field | What It Means |
|------|---------------|
| `address` | For on-chain Bitcoin transactions: the Bitcoin address that was used (either the address you sent to, or your receiving address). Empty for Lightning transactions. |
| `txHash` | The Bitcoin blockchain transaction ID. You can look this up on any blockchain explorer (like mempool.space) to see the transaction on the public blockchain. For Lightning payments, this may show the payment hash instead. |

## Understanding Transaction Types

The **type** field tells you what kind of transaction this was. Here's a complete breakdown:

### Receiving Payments (Money Coming In)

| Type | What It Means |
|------|---------------|
| `invoice` | You received a Lightning payment. Someone paid a Lightning invoice you created, or they sent to your Lightning address. This is the most common type for receiving payments. |
| `onchain_receipt` | You received Bitcoin directly on the blockchain (not Lightning). Someone sent BTC to your on-chain Bitcoin address. |
| `fee_reimbursement` | Blink reimbursed excess routing fees to you. When sending a Lightning payment, Blink sometimes cannot probe the destination node to determine the exact routing cost in advance. In these cases, Blink charges a higher estimated fee upfront to ensure your payment goes through. After the payment settles and the actual routing fee is known, Blink automatically reimburses the difference between what you were charged and what the payment actually cost. |

### Sending Payments (Money Going Out)

| Type | What It Means |
|------|---------------|
| `payment` | You sent a Lightning payment to someone outside of Blink. This payment went through the Lightning Network to reach its destination. |
| `onchain_payment` | You sent Bitcoin on the blockchain. This is a standard Bitcoin transaction that gets confirmed by miners. |

### Transfers Within Blink (Internal)

| Type | What It Means |
|------|---------------|
| `on_us` | You sent money to another Blink user using their username or Lightning address.  The payment stayed within Blink's system (instant
and free). |
| `ln_on_us` | Similar to `on_us` – a Lightning payment to another Blink user that stayed within the network. |
| `onchain_on_us` | An on-chain style transfer to another Blink user. Rare, as Lightning is preferred within Blink. |

### Currency Conversions (Swaps Between Your Own Wallets)

| Type | What It Means |
|------|---------------|
| `self_trade` | You converted money between your BTC wallet and your USD (Stablesats) wallet. For example, moving $10 from Stablesats to Bitcoin. You'll see two transactions: a debit from one wallet and a credit to the other. |
| `ln_self_trade` | Same as `self_trade` but processed via Lightning. This is Blink's internal swap mechanism. |
| `onchain_self_trade` | A wallet-to-wallet conversion using on-chain methods. Rare. |

### Administrative (System Transactions)

| Type | What It Means |
|------|---------------|
| `fee` | A system fee charged by Blink. |
| `escrow` | Funds held in escrow for a pending transaction. |
| `reconciliation` | A balance adjustment made by the system. |

## Common Questions

### About Display Values

**Q: What's the difference between `credit` / `debit` and `displayAmount`?**

**A:** `credit` and `debit` show the actual Bitcoin amount in satoshis (or cents for USD wallet).
`displayAmount` shows what that Bitcoin was worth in your preferred display currency (like USD) at the time of the transaction.

**Example:** You received 7,685 satoshis

* `credit` = 7685  
* `displayAmount` = 709 (worth $7.09 USD at the time)  
* `displayCurrency` = USD

**Q: Why are `displayAmount` values sometimes in the hundreds for small payments?**

**A:** The `displayAmount` is in the minor unit of the currency. For USD, it's in cents. So 709 means $7.09. For Tanzanian Shillings (TZS), 499943 means 499,943 TZS.

### About Transaction Types

**Q: I see `invoice` for received payments and `payment` for sent. Why different names?**

**A:** In Lightning Network terminology:
* When you receive, someone paid your **invoice** (payment request).
* When you send, you made a **payment** to someone else's invoice.

**Q: What's the difference between `self_trade` and `ln_self_trade`?**

**A:** Both are conversions between your BTC and USD wallets. `ln_self_trade` processes through Lightning internally (you'll see "swap invoice" in the lnMemo). Functionally, they're the same for you - just different internal mechanisms.

**Q: Why do I see two transactions when I convert between wallets?**

**A:** Wallet conversions always create a pair of transactions:

1. A **debit** from the source wallet (money going out)
2. A **credit** to the destination wallet (money coming in)

Both will have a `self_trade` or `ln_self_trade` type.

### About Empty Fields

**Q: Why are some fields empty?**

**A:** Not all fields apply to every transaction:

* `address` and `txHash` are only for on-chain Bitcoin transactions
* `username` only appears for transactions with other Blink users
* `paymentHash` is only for Lightning transactions
* `memoFromPayer` only appears if the sender included a note

**Q: What does an empty `fee` mean?**

A: An empty fee typically means:

* The transaction was free (internal Blink transfer)
* You were the receiver (fees are paid by sender)
* The fee information wasn't applicable

## Tips for Working with Your Export

1. **Opening CSV files**: Use Microsoft Excel, Google Sheets, or LibreOffice Calc.
2. **Converting timestamps**: The timestamp is already human-readable. For sorting by date in a spreadsheet, you may want to convert it to your local timezone.
3. **Calculating totals**:
   - Sum the `credit` column for total received
   - Sum the `debit` column for total sent
   - Remember: BTC values are in satoshis (divide by 100,000,000 for BTC)
4. **Filtering by type**: Use your spreadsheet's filter to see only specific transaction types (e.g., only invoice for all received Lightning payments).
5. Matching wallet conversions: When you swap between BTC and USD wallets, look for matching timestamps with `self_trade` or `ln_self_trade` types - one will be credit, one will be debit.

## Quick Reference: Transaction Types

| Type | Direction | Description |
|------|----------|-------------|
| invoice | Receive | Lightning payment received |
| payment | Send | Lightning payment sent externally |
| on_us / ln_on_us | Send | Payment to another Blink user |
| self_trade / ln_self_trade | Both | Conversion between your wallets |
| onchain_receipt | Receive | On-chain Bitcoin received |
| onchain_payment | Send | On-chain Bitcoin sent |
| fee_reimbursement | Receive | Excess routing fee refund |
