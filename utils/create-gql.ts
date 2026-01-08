// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gqlPluckFromCodeStringSync } = require("@graphql-tools/graphql-tag-pluck")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gql } = require("@apollo/client")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { addTypenameToDocument } = require("@apollo/client/utilities")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { print: printGql } = require("graphql")

const filepath = "app/graphql/generated.ts"

const result = gqlPluckFromCodeStringSync(filepath, fs.readFileSync(filepath, "utf8"))
const asStr = result
  .filter((item) => !item.body.includes("@client"))
  .map((item) => item.body + "\n\n")
  .sort()
  .join("")

const withTypename = printGql(addTypenameToDocument(gql(asStr)))

fs.writeFileSync("app/graphql/generated.gql", withTypename)
