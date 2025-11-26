import KeyStoreWrapper from "@app/utils/storage/secureStorage"

export const fetchProfiles = async (currentToken: string): Promise<ProfileProps[]> => {
  const storedProfiles = await KeyStoreWrapper.getSessionProfiles()

  return storedProfiles.map((profile) => ({
    ...profile,
    selected: profile.token === currentToken,
  }))
}
