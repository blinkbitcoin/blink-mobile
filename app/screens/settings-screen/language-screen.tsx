import * as React from "react"

import { gql } from "@apollo/client"

import { MenuSelect, MenuSelectItem } from "@app/components/menu-select"
import { useEffectiveLanguage } from "@app/hooks/use-effective-language"
import { useI18nContext } from "@app/i18n/i18n-react"
import { LocaleToTranslateLanguageSelector } from "@app/i18n/mapping"
import { getLanguageFromString, Languages } from "@app/utils/locale-detector"

import { Screen } from "../../components/screen"

gql`
  query language {
    me {
      id
      language
    }
  }

  mutation userUpdateLanguage($input: UserUpdateLanguageInput!) {
    userUpdateLanguage(input: $input) {
      errors {
        message
      }
      user {
        id
        language
      }
    }
  }
`

export const LanguageScreen: React.FC = () => {
  const { language: serverLanguage, setLanguage, loading } = useEffectiveLanguage()
  const languageFromServer = getLanguageFromString(serverLanguage)
  const { LL } = useI18nContext()

  const [newLanguage, setNewLanguage] = React.useState("")

  const handleUpdateLanguage = async (language: string) => {
    if (loading) return
    await setLanguage(language)
    setNewLanguage(language)
  }

  return (
    <Screen preset="scroll">
      <MenuSelect
        value={newLanguage || languageFromServer}
        onChange={handleUpdateLanguage}
      >
        {Languages.map((language) => {
          let languageTranslated: string
          if (language === "DEFAULT") {
            languageTranslated = LL.Languages[language]()
          } else {
            languageTranslated = LocaleToTranslateLanguageSelector[language]
          }

          return (
            <MenuSelectItem
              key={language}
              value={language}
              testPropId={languageTranslated}
            >
              {languageTranslated}
            </MenuSelectItem>
          )
        })}
      </MenuSelect>
    </Screen>
  )
}
