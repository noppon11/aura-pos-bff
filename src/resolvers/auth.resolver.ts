import axios from 'axios'
import type { GraphQLResolveInfo } from 'graphql'
import { BffContext } from '../context'

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.POS_SERVICE_URL || 'http://localhost:8080/api/v1'

export const authResolvers = {
  Query: {
    me: async (_parent: object, _args: Record<string, never>, ctx: BffContext, _info: GraphQLResolveInfo) => {
      if (!ctx.user) {
        throw new Error('Unauthenticated')
      }

      try {
        const { data } = await axios.get(`${BACKEND_URL}/users/${ctx.user.id}`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        })
        return data
      } catch {
        // Fall back to the JWT claims if backend is unavailable
        return ctx.user
      }
    },
  },

  Mutation: {
    logout: async (_parent: object, _args: Record<string, never>, ctx: BffContext, _info: GraphQLResolveInfo) => {
      // Actual cookie clearing must happen via the REST route (needs res object).
      // This mutation just signals success for GraphQL clients.
      if (!ctx.user) return false
      return true
    },
  },
}
