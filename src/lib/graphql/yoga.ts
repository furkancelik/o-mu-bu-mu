import { createSchema, createYoga } from "graphql-yoga";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { getAdminFromRequest } from "@/lib/auth";

export type GraphQLContext = {
  isAdmin: boolean;
};

const { handleRequest } = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  cors: false,
  graphiql: process.env.NODE_ENV !== "production",
  maskedErrors: process.env.NODE_ENV === "production",
  context: async ({ request }): Promise<GraphQLContext> => ({
    isAdmin: await getAdminFromRequest(request),
  }),
});

export { handleRequest };
