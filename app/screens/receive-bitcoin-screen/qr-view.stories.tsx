import * as React from "react"

import { Story, UseCase } from "../../../.storybook/views"
import { Invoice } from "./payment/index.types"
import { QRView } from "./qr-view"

export default {
  title: "QRView",
  component: QRView,
}

export const Invoices = () => {
  return (
    <Story>
      <UseCase text="Lightning">
        <QRView
          type={Invoice.Lightning}
          getFullUri={() =>
            "lntbs1pjt94dkpp5w804h2j6mn72kuew2vyjtznw5h7nta8awzagpnp50vy950dpcmqsdp22pshjgr5dus9xarpva5kueeq2askcmr9wss82um9wgcqzpuxqyz5vqsp538ke93xd5y284gu9mjet2rfgqn2fxw0upck9feuvp0u6m8fcysmq9qyyssqnasjtzezl03rzzk6lxvs9u7ma6rflpqe2v36jdsjfgyfyx9rff6xf0wd3qe226dek528v5hqqc9l947j223wx363mjryyjp9v55m4asqhdcawf"
          }
          loading={false}
          completed={false}
          expired={false}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
      <UseCase text="OnChain">
        <QRView
          type={Invoice.OnChain}
          getFullUri={() =>
            "bitcoin:tb1qstk6xund50xqcrnz7vsly2rke6xpw05pc7lmz5?message=Pay%2520to%2520Staging%2520Wallet%2520user"
          }
          loading={false}
          completed={false}
          expired={false}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
      <UseCase text="Paycode">
        <QRView
          type={Invoice.PayCode}
          getFullUri={() =>
            "HTTPS://PAY.STAGING.BLINK.SV/TEST1?LIGHTNING=LNURL1DP68GURN8GHJ7URP0YH8XARPVA5KUEEWVASKCMME9E5K7TEWWAJKCMPDDDHX7AMW9AKXUATJD3CZ7UMPDEJXJURWV3JHVH6AG5Y"
          }
          loading={false}
          completed={false}
          expired={false}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
    </Story>
  )
}

export const States = () => {
  return (
    <Story>
      <UseCase text="Paid">
        <QRView
          type={Invoice.Lightning}
          getFullUri={() =>
            "lntbs1pjt94dkpp5w804h2j6mn72kuew2vyjtznw5h7nta8awzagpnp50vy950dpcmqsdp22pshjgr5dus9xarpva5kueeq2askcmr9wss82um9wgcqzpuxqyz5vqsp538ke93xd5y284gu9mjet2rfgqn2fxw0upck9feuvp0u6m8fcysmq9qyyssqnasjtzezl03rzzk6lxvs9u7ma6rflpqe2v36jdsjfgyfyx9rff6xf0wd3qe226dek528v5hqqc9l947j223wx363mjryyjp9v55m4asqhdcawf"
          }
          loading={false}
          completed={true}
          expired={false}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
      <UseCase text="Loading">
        <QRView
          type={Invoice.Lightning}
          getFullUri={() =>
            "lntbs1pjt94dkpp5w804h2j6mn72kuew2vyjtznw5h7nta8awzagpnp50vy950dpcmqsdp22pshjgr5dus9xarpva5kueeq2askcmr9wss82um9wgcqzpuxqyz5vqsp538ke93xd5y284gu9mjet2rfgqn2fxw0upck9feuvp0u6m8fcysmq9qyyssqnasjtzezl03rzzk6lxvs9u7ma6rflpqe2v36jdsjfgyfyx9rff6xf0wd3qe226dek528v5hqqc9l947j223wx363mjryyjp9v55m4asqhdcawf"
          }
          loading={true}
          completed={false}
          expired={false}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
      <UseCase text="Expired">
        <QRView
          type={Invoice.Lightning}
          getFullUri={() =>
            "lntbs1pjt94dkpp5w804h2j6mn72kuew2vyjtznw5h7nta8awzagpnp50vy950dpcmqsdp22pshjgr5dus9xarpva5kueeq2askcmr9wss82um9wgcqzpuxqyz5vqsp538ke93xd5y284gu9mjet2rfgqn2fxw0upck9feuvp0u6m8fcysmq9qyyssqnasjtzezl03rzzk6lxvs9u7ma6rflpqe2v36jdsjfgyfyx9rff6xf0wd3qe226dek528v5hqqc9l947j223wx363mjryyjp9v55m4asqhdcawf"
          }
          loading={false}
          completed={false}
          expired={true}
          err={""}
          isPayCode={false}
          canUsePayCode={true}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
      <UseCase text="Can't use Paycode">
        <QRView
          type={Invoice.PayCode}
          getFullUri={() => ""}
          loading={false}
          completed={false}
          expired={false}
          err={""}
          isPayCode={true}
          canUsePayCode={false}
          toggleIsSetLightningAddressModalVisible={() => {}}
        />
      </UseCase>
    </Story>
  )
}
