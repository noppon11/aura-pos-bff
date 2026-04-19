import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { buildContext } from './context'
import { authResolvers } from './resolvers/auth.resolver'
import { productResolvers } from './resolvers/product.resolver'
import { branchResolvers } from './resolvers/branch.resolver'

// ── Load .graphql schema files ─────────────────────────
function loadSchema(): string {
  const schemaDir = path.join(__dirname, 'schema')
  const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.graphql'))
  return files.map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf-8')).join('\n')
}

// ── Merge all resolvers ────────────────────────────────
const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...productResolvers.Query,
    ...branchResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
  },
}

const PORT = parseInt(process.env.PORT || '4000', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

async function bootstrap() {
  const app = express()

  const server = new ApolloServer({
    typeDefs: loadSchema(),
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
  })

  await server.start()

  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json())

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aura-pos-bff' })
  })

  // GraphQL
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => buildContext(req),
    }),
  )

  app.listen(PORT, () => {
    console.log(`🚀 BFF ready   → http://localhost:${PORT}/graphql`)
    console.log(`🏥 Health      → http://localhost:${PORT}/health`)
    console.log(`📡 pos-service → ${process.env.POS_SERVICE_URL || 'http://localhost:8080'}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start BFF:', err)
  process.exit(1)
})
