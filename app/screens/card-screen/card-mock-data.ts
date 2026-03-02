export type CardTransaction = {
  id: string
  merchantName: string
  timeAgo: string
  amount: string
  status: "pending" | "completed"
}

export type TransactionGroup = {
  date: string
  transactions: CardTransaction[]
}

export type CardInfo = {
  cardNumber: string
  holderName: string
  validThruDate: string
}

export const MOCK_CARD: CardInfo = {
  cardNumber: "2121 2121 2121 2121",
  holderName: "SATOSHI NAKAMOTO",
  validThruDate: "2028-12-01",
}

export const MOCK_TRANSACTIONS: TransactionGroup[] = [
  {
    date: "Today",
    transactions: [
      {
        id: "1",
        merchantName: "SuperSelectos",
        timeAgo: "2 minutes ago",
        amount: "-$12.50",
        status: "pending",
      },
      {
        id: "2",
        merchantName: "Starbucks",
        timeAgo: "1 hour ago",
        amount: "-$5.75",
        status: "completed",
      },
      {
        id: "3",
        merchantName: "Uber Eats",
        timeAgo: "3 hours ago",
        amount: "-$8.99",
        status: "completed",
      },
    ],
  },
  {
    date: "Yesterday",
    transactions: [
      {
        id: "4",
        merchantName: "Amazon",
        timeAgo: "12 hours ago",
        amount: "-$24.99",
        status: "completed",
      },
      {
        id: "5",
        merchantName: "Netflix",
        timeAgo: "18 hours ago",
        amount: "-$15.99",
        status: "completed",
      },
      {
        id: "6",
        merchantName: "Walmart",
        timeAgo: "22 hours ago",
        amount: "-$32.40",
        status: "completed",
      },
    ],
  },
]

export const EMPTY_TRANSACTIONS: TransactionGroup[] = []
