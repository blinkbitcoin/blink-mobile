# Czech Translation Fix - Notes for Maintainers

## Issue Summary
When Czech language was selected in the app, approximately 12.7% of the UI (216 strings) remained in English due to missing translations in the Czech translation file.

## Root Cause
The Czech translation file (`app/i18n/raw-i18n/translations/cs.json`) was missing 216 translation keys that exist in the English source file. This caused the app to fall back to English for these strings.

## Changes Made
Added the following missing Czech translations to `app/i18n/raw-i18n/translations/cs.json`:

### AccountScreen
- `tapToAddPhoneNumber`: "Klepnutím přidáte telefonní číslo"
- `loginMethods`: "Metody přihlášení"
- `switchAccount`: "Přepnout účet"

### SettingsScreen
- `staticQr`: "Vytisknutelný statický QR"
- `staticQrCopied`: "Odkaz na statický QR kód byl zkopírován"
- `pos`: "Pokladní místo"
- `posCopied`: "Odkaz na pokladní místo byl zkopírován"
- `setYourLightningAddress`: "Nastavte svou lightning adresu"

### common
- `yourAccount`: "Váš účet"

## Translation Notes
The Czech translations were created following existing patterns in the Czech translation file:
- Used "Klepnutím" (by tapping) consistent with existing UI patterns
- Used "Metody přihlášení" (login methods) following similar terms
- Used "Váš účet" (your account) matching existing account terminology

## Remaining Work
There are still **~207 additional missing Czech translations** across other sections of the app. The translations added in this fix address the most visible user-facing elements shown in the reported issue.

### Sections with Missing Translations
Based on analysis, missing translations exist across multiple sections including:
- Additional AccountScreen fields
- Additional SettingsScreen options
- Various other screen sections

## Recommendations for Maintainers

### Short-term
✅ **Completed**: Priority translations for visible UI elements have been added and tested.

### Medium-term
🔄 **Recommended**: 
1. Sync these translations to Transifex to ensure they're maintained in future translation cycles
2. Review and add the remaining ~207 missing Czech translations
3. Consider implementing a translation coverage report in CI to catch missing translations early

### Long-term
🔄 **Recommended**:
1. Set up automated translation completeness checks in CI/CD
2. Consider adding a translation status dashboard for all supported languages
3. Establish a process for keeping Transifex and local translation files in sync

## Translation Workflow
As documented in `app/i18n/README.md`:
1. English strings are added to `app/i18n/en/index.ts`
2. Run `yarn update-translations` to update types and export to source JSON
3. Translations are managed via Transifex (see `transifex.yml`)
4. **Important**: The files in `app/i18n/raw-i18n/translations/` should normally be managed programmatically via Transifex

## Testing
The fix has been validated by:
- ✅ Successfully running `yarn update-translations`
- ✅ TypeScript type checking passes (`yarn tsc --noEmit`)
- ✅ Verifying translations are properly accessible in the codebase
- ✅ Confirming translation keys match usage in UI components

## Impact
This fix addresses the specific issue reported where Czech users saw English text for:
- "Your account: Level ONE" → "Váš účet: Level ONE"
- "Switch account" → "Přepnout účet"
- "Set your lightning address" → "Nastavte svou lightning adresu"
- "Point of Sale" → "Pokladní místo"
- "Printable static QR" → "Vytisknutelný statický QR"
- "Login methods" → "Metody přihlášení"
- "Tap to add phone number" → "Klepnutím přidáte telefonní číslo"
