## i18n

1. If you want to add or edit a string in the wallet, you need to edit:
    ```
    en/index.ts
    ```
2. to update the translations for other languages run:
    ```
    yarn update-translations
    ```

### why the folder structure?

Blink-mobile relies on typesafe-i18n which has an [opinionated file structure](https://github.com/ivanhofer/typesafe-i18n/tree/main/packages/generator#folder-structure)

## additing a new language:

if the new language code is `af`: 

- copy `ca/index.ts` into `af/index.ts`
- rename `ca.json` to `af.json` in `af/index.ts`
- add import formatjs into `mapping.ts` (`import "@formatjs/intl-relativetimeformat/locale-data/af"`)
- add mapping into `mapping.ts` with `language-code:native-language-name`
- run `yarn update-translations`
