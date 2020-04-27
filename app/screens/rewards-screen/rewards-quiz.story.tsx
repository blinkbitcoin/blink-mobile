import { storiesOf } from "@storybook/react-native";
import * as React from "react";
import { Story, StoryScreen, UseCase } from "../../../storybook/views";
import { RewardsQuiz } from "./rewards-quiz";
import { cloneDeep } from "lodash"
import { Text } from "react-native";

declare let module

const route = { params: {
  title: "So what exactly is Bitcoin?",
  text: "Bitcoin is digital money.\n\nIt can be transferred swiftly and securely between any two people in the world — without the need for a bank or any other financial company in the middle.",
  amount: 1,
  question: "So what exactly is Bitcoin?",
  answers: [
    "The smallest unit of Bitcoin",
    "An alternative crypto currency",
    "A small satellite"
  ],
  feedback: [
    "You just earned 1 sat, the smallest unit of Bitcoin. Congrats!",
    "Nope, it is not analtcoin",
    "Maybe... but that's not the correct answer in this context 😂"
  ],
  onComplete: () => {},
  completed: false,
}}

let route_completed = cloneDeep(route)
route_completed.params.completed = true

storiesOf("Quiz", module)
  .addDecorator((fn) => <StoryScreen>{fn()}</StoryScreen>)
  .add("Style Presets", () => (
    <Story >
    <UseCase text="not earned">
        <RewardsQuiz route={route} />  
      </UseCase>
      <UseCase text="earned">
        <RewardsQuiz route={route_completed} />
      </UseCase>
    </Story>
  ))
