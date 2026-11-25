/** The additional data step's answers. The terms step sends them with the application,
 *  since the issuer takes an application only together with the accepted terms. */
export type CardApplicationAnswers = {
  occupation: string
  annualSalary: string
  accountPurpose: string
  expectedMonthlyVolume: string
}
