import { GraphQLError } from 'graphql'
import { authApi } from '../datasources/pos-api'
import type { GraphQLContext } from '../context'

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'UNAUTHORIZED' },
        })
      }
      try {
        const res = await authApi.me(ctx.token!, ctx.tenantId)
        return res.data
      } catch {
        return ctx.user
      }
    },
  },

  Mutation: {
    login: async (
      _: unknown,
      { email, password, tenantId }: { email: string; password: string; tenantId: string },
    ) => {
      try {
        const res = await authApi.login(email, password, tenantId)
        const { token, user } = res.data
        if (!token || !user) throw new GraphQLError('Invalid response from auth service')
        return { token, user }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string }; status?: number } }
        const msg = axiosErr?.response?.data?.message || 'Invalid credentials'
        const status = axiosErr?.response?.status
        if (status === 401 || status === 403) {
          throw new GraphQLError(msg, { extensions: { code: 'UNAUTHENTICATED' } })
        }
        throw new GraphQLError(msg, { extensions: { code: 'INTERNAL_SERVER_ERROR' } })
      }
    },

    logout: () => true,
  },
}
