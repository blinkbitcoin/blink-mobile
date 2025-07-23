import { GraphQLError, GraphQLFormattedError } from "graphql"

import { ApolloError } from "@apollo/client"

import { GraphQlApplicationError } from "./generated"

type ErrorInput =
  | readonly GraphQLError[]
  | readonly GraphQLFormattedError[]
  | readonly GraphQlApplicationError[]
  | ApolloError

export const getErrorMessages = (error: ErrorInput): string => {
  if (Array.isArray(error)) {
    return error.map((err) => err.message).join(", ")
  }
  if (error instanceof ApolloError) {
    if (error.graphQLErrors && error.graphQLErrors.length > 0) {
      return error.graphQLErrors.map(({ message }) => message).join("\n ")
    }
    return error.message
  }
  if ("message" in error) {
    return `${error.message}`
  }
  return "Something went wrong"
}
