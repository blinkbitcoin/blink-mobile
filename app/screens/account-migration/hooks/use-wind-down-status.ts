import { WindDown, windDownMock } from "../utils/backend-mock"

/**
 * TODO: TEMPORARY mock — replace with the backend wind-down status query
 * (Account.windDown) once it is ready. Serves the account's wind-down state to the
 * migration surfaces (gate mode, dollar precondition, receive-disabled home, deadline
 * dates); the status is server-authoritative and the client must never derive it
 * from dates.
 */
export const useWindDownStatus = (): WindDown => windDownMock
