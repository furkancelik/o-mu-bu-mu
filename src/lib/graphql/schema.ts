export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar JSON

  type GameImage {
    id: ID!
    url: String!
    fileName: String!
    width: Int
    height: Int
    elo: Float!
    wins: Int!
    losses: Int!
    appearances: Int!
  }

  type Game {
    id: ID!
    slug: String!
    title: String!
    description: String
    images: [GameImage!]!
    status: String!
    totalSessions: Int!
    totalVotes: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Pair {
    a: GameImage!
    b: GameImage!
  }

  type SessionState {
    sessionKey: String!
    gameSlug: String!
    phase: String!
    round: Int!
    totalRoundsEstimate: Int!
    pair: Pair
    finished: Boolean!
    winner: GameImage
  }

  type ImageStat {
    image: GameImage!
    sessionWins: Int!
    sessionFinals: Int!
    voteWins: Int!
    voteLosses: Int!
    appearances: Int!
    winRate: Float!
  }

  type Analytics {
    gameId: ID!
    totalSessions: Int!
    finishedSessions: Int!
    totalVotes: Int!
    avgVotesPerSession: Float!
    leaderboard: [ImageStat!]!
    finalWinnerCounts: [ImageStat!]!
    headToHead: JSON!
  }

  input ImageInput {
    url: String!
    fileName: String!
    width: Int
    height: Int
  }

  type Query {
    game(slug: String!): Game
    games: [Game!]!
    session(sessionKey: String!): SessionState
    analytics(slug: String!): Analytics
  }

  type Mutation {
    createGame(title: String!, description: String, images: [ImageInput!]!): Game!
    updateGame(slug: String!, title: String, description: String): Game!
    addImages(slug: String!, images: [ImageInput!]!): Game!
    deleteImage(slug: String!, imageId: ID!): Game!
    deleteGame(slug: String!): Boolean!

    startSession(slug: String!): SessionState!
    submitVote(sessionKey: String!, winnerImageId: ID!, loserImageId: ID!): SessionState!
  }
`;
