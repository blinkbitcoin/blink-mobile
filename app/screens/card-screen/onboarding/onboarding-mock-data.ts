// Mock/placeholder data — labels will come from backend when available
export const MOCK_CARD_DISPLAY = {
  cardNumber: "2121212121212121",
  holderName: "SATOSHI NAKAMOTO",
  validThruDate: "2028-01-01",
}

export const MOCK_CARD_PAYMENT = {
  price: "$1,000",
  renewalDate: "Aug 21, 2026",
}

export const MOCK_OCCUPATION_OPTIONS = [
  { value: "15-1132", label: "Software Developers, Applications" },
  { value: "11-1021", label: "General and Operations Managers" },
  { value: "29-1141", label: "Registered Nurses" },
  { value: "25-2021", label: "Elementary School Teachers" },
  { value: "41-3099", label: "Sales Representatives, Services" },
  { value: "13-2011", label: "Accountants and Auditors" },
  { value: "43-6014", label: "Secretaries and Administrative Assistants" },
  { value: "47-2031", label: "Carpenters" },
  { value: "53-3032", label: "Heavy and Tractor-Trailer Truck Drivers" },
  { value: "35-3031", label: "Waiters and Waitresses" },
]

export const MOCK_ANNUAL_SALARY_OPTIONS = [
  { value: "Less than 25,000", label: "Less than $25,000" },
  { value: "25,000 - 49,999", label: "$25,000 - $49,999" },
  { value: "50,000 - 74,999", label: "$50,000 - $74,999" },
  { value: "75,000 - 99,999", label: "$75,000 - $99,999" },
  { value: "100,000 - 149,999", label: "$100,000 - $149,999" },
  { value: "150,000 - 249,999", label: "$150,000 - $249,999" },
  { value: "250,000 or more", label: "$250,000 or more" },
]

export const MOCK_ACCOUNT_PURPOSE_OPTIONS = [
  { value: "Personal spending", label: "Personal spending" },
  { value: "Business card", label: "Business card" },
  { value: "Other", label: "Other" },
]

export const MOCK_EXPECTED_MONTHLY_VOLUME_OPTIONS = [
  { value: "Less than 1,000", label: "Less than $1,000" },
  { value: "1,000 - 1,999", label: "$1,000 - $1,999" },
  { value: "2,000 - 2,999", label: "$2,000 - $2,999" },
  { value: "3,000 or more", label: "$3,000 or more" },
]
