/**
 * Whether an Apollo error is a transport failure the network can still recover from,
 * rather than an application error the server settled on. It is the line between offering
 * a retry and handing over: a dropped connection can be sent again, a rejection cannot.
 */
export const isNetworkFailure = (err: unknown): boolean =>
  Boolean(err instanceof Error && "networkError" in err && err.networkError)
