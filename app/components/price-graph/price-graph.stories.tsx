import * as React from "react"
import { storiesOf } from "@storybook/react-native"
import { StoryScreen } from "../../../storybook/views"
import { PriceGraph } from "./price-graph"
import { prices } from "./data-tst"

declare let module

storiesOf("Price Component", module)
  .addDecorator((fn) => <StoryScreen>{fn()}</StoryScreen>)
  .add("Price Graph", () => <PriceGraph prices={prices} />)
