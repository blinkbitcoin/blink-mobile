import { YearOption } from "@app/components/year-selector"

export type StatementData = {
  id: string
  month: string
  year: number
  period: string
  transactionCount: number
  totalSpent: string
  isCurrent: boolean
  isDownloaded: boolean
}

export const MOCK_STATEMENTS: StatementData[] = [
  {
    id: "1",
    month: "August",
    year: 2025,
    period: "Aug 1 - Aug 30",
    transactionCount: 0,
    totalSpent: "$1,021.00",
    isCurrent: true,
    isDownloaded: false,
  },
  {
    id: "2",
    month: "July",
    year: 2025,
    period: "Jul 1 - Jul 30, 2025",
    transactionCount: 5,
    totalSpent: "$121.00",
    isCurrent: false,
    isDownloaded: true,
  },
  {
    id: "3",
    month: "June",
    year: 2025,
    period: "Jun 1 - Jun 30, 2025",
    transactionCount: 5,
    totalSpent: "$121.00",
    isCurrent: false,
    isDownloaded: true,
  },
]

export const MOCK_YEAR_OPTIONS: YearOption[] = [
  { year: 2025, itemCount: 3 },
  { year: 2024, itemCount: 0, disabled: true },
  { year: 2023, itemCount: 0, disabled: true },
]

export const DEFAULT_YEAR = 2025
