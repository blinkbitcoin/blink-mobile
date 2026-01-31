export type TransactionDetails = {
  transactionId: string
  cardUsed: string
  paymentMethod: string
  time: string
  merchant: string
  category: string
  location: string
  mccCode: string
  bitcoinRate: string
  bitcoinSpent: string
  conversionFee: string
}

export type CardTransaction = {
  id: string
  merchantName: string
  timeAgo: string
  amount: string
  status: "pending" | "completed"
  details: TransactionDetails
}

export type TransactionGroup = {
  date: string
  transactions: CardTransaction[]
}

export const CardStatus = {
  Active: "active",
  Frozen: "frozen",
  Inactive: "inactive",
} as const

export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus]

export type CardInfo = {
  cardNumber: string
  holderName: string
  validThruDate: string
  cvv: string
  expiryDate: string
  cardType: string
  status: CardStatus
  issuedDate: string
  network: string
}

export const MOCK_CARD: CardInfo = {
  cardNumber: "2121 2121 2121 2121",
  holderName: "SATOSHI NAKAMOTO",
  validThruDate: "2028-12-01",
  cvv: "123",
  expiryDate: "09/29",
  cardType: "Virtual Visa debit",
  status: CardStatus.Active,
  issuedDate: "April 23, 2025",
  network: "Visa",
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
        details: {
          transactionId: "TXN-2025-000001",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Chip",
          time: "Jan 30, 10:58 AM",
          merchant: "SuperSelectos",
          category: "Groceries",
          location: "Blvd. Los Héroes, San Salvador, El Salvador",
          mccCode: "5411",
          bitcoinRate: "$102,450.00",
          bitcoinSpent: "12,203 SAT",
          conversionFee: "$0.00",
        },
      },
      {
        id: "2",
        merchantName: "Starbucks",
        timeAgo: "1 hour ago",
        amount: "-$5.75",
        status: "completed",
        details: {
          transactionId: "TXN-2025-000002",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Contactless",
          time: "Jan 30, 9:00 AM",
          merchant: "Starbucks",
          category: "Food & Dining",
          location: "Prospera Place, Kelowna, BC, Canada",
          mccCode: "5814",
          bitcoinRate: "$102,380.00",
          bitcoinSpent: "5,617 SAT",
          conversionFee: "$0.00",
        },
      },
      {
        id: "3",
        merchantName: "Uber Eats",
        timeAgo: "3 hours ago",
        amount: "-$8.99",
        status: "completed",
        details: {
          transactionId: "TXN-2025-000003",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Online",
          time: "Jan 30, 7:00 AM",
          merchant: "Uber Eats",
          category: "Food Delivery",
          location: "Online",
          mccCode: "5812",
          bitcoinRate: "$102,200.00",
          bitcoinSpent: "8,797 SAT",
          conversionFee: "$0.00",
        },
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
        details: {
          transactionId: "TXN-2025-000004",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Online",
          time: "Jan 29, 10:00 PM",
          merchant: "Amazon.com",
          category: "Shopping",
          location: "Online",
          mccCode: "5942",
          bitcoinRate: "$101,950.00",
          bitcoinSpent: "24,513 SAT",
          conversionFee: "$0.00",
        },
      },
      {
        id: "5",
        merchantName: "Netflix",
        timeAgo: "18 hours ago",
        amount: "-$15.99",
        status: "completed",
        details: {
          transactionId: "TXN-2025-000005",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Online",
          time: "Jan 29, 4:00 PM",
          merchant: "Netflix",
          category: "Entertainment",
          location: "Online",
          mccCode: "4899",
          bitcoinRate: "$101,800.00",
          bitcoinSpent: "15,707 SAT",
          conversionFee: "$0.00",
        },
      },
      {
        id: "6",
        merchantName: "Walmart",
        timeAgo: "22 hours ago",
        amount: "-$32.40",
        status: "completed",
        details: {
          transactionId: "TXN-2025-000006",
          cardUsed: "Visa •••• 2121",
          paymentMethod: "Chip",
          time: "Jan 29, 12:00 PM",
          merchant: "Walmart Supercenter",
          category: "Groceries",
          location: "Centro Comercial Metrocentro, San Salvador",
          mccCode: "5411",
          bitcoinRate: "$101,650.00",
          bitcoinSpent: "31,879 SAT",
          conversionFee: "$0.00",
        },
      },
    ],
  },
]

export const EMPTY_TRANSACTIONS: TransactionGroup[] = []
