import { WindDown } from "@app/types/wind-down"

import { windDownMock } from "../utils/backend-mock"

/**
 * TODO: TEMPORARY mock, replace with the backend wind-down status query
 * (Query.windDown) once it is ready. Serves the account's wind-down state to the
 * migration surfaces (gate mode, dollar precondition, receive-disabled home, deadline
 * dates); the status is server-authoritative and the client must never derive it
 * from dates. Null means the wind-down does not affect this account (the backend
 * omits the field), so every wind-down surface must stay off.
 */
export const useWindDownStatus = (): WindDown | null => windDownMock
