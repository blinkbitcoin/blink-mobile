type ProfileProps = {
  userId?: string | null
  identifier: string
  token: string
  selected: boolean
  avatarUrl?: string
  phone?: string | null
  email?: string | null
  accountId?: string
  isFirstItem?: boolean
}

type FetchUsername = LazyQueryExecFunction<GetUsernamesQuery, Record<string, never>>

type TryFetchUserProps = {
  token: string
  fetchUsername: FetchUsername
}
