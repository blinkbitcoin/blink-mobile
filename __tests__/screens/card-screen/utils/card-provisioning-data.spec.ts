import {
  fetchCardProvisioningData,
  isCardProvisioningAvailable,
} from "@app/screens/card-screen/utils/card-provisioning-data"

describe("card provisioning data", () => {
  it("is not available until the backend exposes Rain's card secret", () => {
    expect(isCardProvisioningAvailable).toBe(false)
  })

  it("refuses to provision a card meanwhile", async () => {
    await expect(fetchCardProvisioningData("card-1")).rejects.toThrow(
      "The backend does not provide card provisioning data yet",
    )
  })
})
