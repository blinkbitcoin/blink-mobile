import { AccountMigrationPreview } from "@app/types/wind-down"

import { getMigrationPreviewMock } from "../utils/backend-mock"

/**
 * TODO: TEMPORARY boundary over the mocked migration preview (Account.migration.preview
 * in the integration contract): swapping in the backend query later touches only this
 * hook, never the screens that render the preview.
 */
export const useMigrationPreview = (balanceSats: number): AccountMigrationPreview =>
  getMigrationPreviewMock(balanceSats)
