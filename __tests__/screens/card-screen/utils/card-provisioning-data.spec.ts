import { fetchCardProvisioningData } from "@app/screens/card-screen/utils/card-provisioning-data"

describe("card provisioning data", () => {
  it("has no request until the backend exposes Rain's card secret", () => {
    expect(fetchCardProvisioningData).toBeNull()
  })
})
