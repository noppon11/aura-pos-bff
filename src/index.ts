import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { ApolloServer, HeaderMap, type HTTPGraphQLRequest } from '@apollo/server'
import { buildContext } from './context'
import { authResolvers } from './resolvers/auth.resolver'
import { productResolvers } from './resolvers/product.resolver'
import { branchResolvers } from './resolvers/branch.resolver'
import authRoutes from './routes/auth.routes'

// ── Load .graphql schema files ────────────────────────
function loadSchema(): string {
  const schemaDir = path.join(__dirname, 'graphql')
  const files = fs.readdirSync(schemaDir)
    .filter((f) => f.endsWith('.graphql'))
    .sort((a, b) => {
      // auth.graphql must load first — it declares base Query/Mutation types.
      // Other files use `extend type Query` which requires the base to exist.
      if (a === 'auth.graphql') return -1
      if (b === 'auth.graphql') return 1
      return a.localeCompare(b)
    })
  return files.map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf-8')).join('\n')
}

// ── Merge all resolvers ───────────────────────────────
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

const PORT        = parseInt(process.env.PORT || '4000', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173'

async function bootstrap() {
  const app = express()

  // ── Security headers ───────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  }))

  // ── CORS — credentials: true is required for HTTP-only cookie auth ──
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // ── Cookie + JSON parsing ──────────────────────────
  app.use(cookieParser(process.env.COOKIE_SECRET))
  app.use(express.json())

  // ── Health check ───────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aura-pos-bff' })
  })

  // ── REST auth endpoints ────────────────────────────
  // POST /api/auth/login   → authenticates, sets HTTP-only cookies, returns { user }
  // POST /api/auth/refresh → rotates tokens silently, returns { ok: true }
  // POST /api/auth/logout  → clears all cookies, returns { ok: true }
  app.use('/api/auth', authRoutes)

  // ── GraphQL ────────────────────────────────────────
  const server = new ApolloServer({
    typeDefs: loadSchema(),
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
  })

  await server.start()

  // ── GraphQL endpoint ───────────────────────────────
  // We use a plain Express handler instead of expressMiddleware() to avoid
  // the TS2769 type conflict caused by Apollo Server bundling its own copy of
  // @types/express, which is structurally incompatible with the project's copy.
  app.post('/graphql', async (req, res) => {
    const ctx = buildContext(req)

    // Copy incoming headers into Apollo's HeaderMap
    const incomingHeaders = new HeaderMap()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        incomingHeaders.set(key, Array.isArray(value) ? value.join(', ') : value)
      }
    }

    const httpGraphQLRequest: HTTPGraphQLRequest = {
      method:  req.method,
      headers: incomingHeaders,
      search:  req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '',
      body:    req.body,
    }

    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async () => ctx,
    })

    // Write status + headers back to Express response
    res.status(httpGraphQLResponse.status ?? 200)
    for (const [key, value] of httpGraphQLResponse.headers) {
      res.setHeader(key, value)
    }

    if (httpGraphQLResponse.body.kind === 'complete') {
      res.send(httpGraphQLResponse.body.string)
    } else {
      // chunked / incremental delivery (@defer)
      res.setHeader('Transfer-Encoding', 'chunked')
      for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
        res.write(chunk)
      }
      res.end()
    }
  })

  app.listen(PORT, () => {
    console.log(`🚀 BFF ready   → http://localhost:${PORT}/graphql`)
    console.log(`🏥 Health      → http://localhost:${PORT}/health`)
    console.log(`🔐 Auth REST   → http://localhost:${PORT}/api/auth/{login,refresh,logout}`)
    console.log(`📡 pos-service → ${process.env.BACKEND_API_URL || process.env.POS_SERVICE_URL || 'http://localhost:8080'}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start BFF:', err)
  process.exit(1)
})
