import { GraphQLError } from 'graphql'
import { branchApi } from '../datasources/pos-api'
import type { GraphQLContext } from '../context'

export const branchResolvers = {
  Query: {
    branches: async (
      _: unknown,
      { tenantId }: { tenantId?: string },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHORIZED' } })
      }
      if (!['admin', 'manager'].includes(ctx.user.role)) {
        throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } })
      }
      try {
        const res = await branchApi.getAll(ctx.token!, tenantId || ctx.tenantId)
        return res.data
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        throw new GraphQLError(
          axiosErr?.response?.data?.message || 'Failed to fetch branches',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } },
        )
      }
    },

    branch: async (
      _: unknown,
      { id, tenantId }: { id: string; tenantId?: string },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHORIZED' } })
      }
      try {
        const res = await branchApi.getById(id, ctx.token!, tenantId || ctx.tenantId)
        return res.data
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
        if (axiosErr?.response?.status === 404) {
          throw new GraphQLError('Branch not found', { extensions: { code: 'NOT_FOUND' } })
        }
        throw new GraphQLError('Failed to fetch branch', { extensions: { code: 'INTERNAL_SERVER_ERROR' } })
      }
    },
  },
}
