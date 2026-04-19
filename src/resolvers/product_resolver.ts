import { GraphQLError } from 'graphql'
import { productApi } from '../datasources/pos-api'
import type { GraphQLContext } from '../context'

export const productResolvers = {
  Query: {
    products: async (
      _: unknown,
      { tenantId }: { tenantId?: string },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHORIZED' } })
      }
      try {
        const res = await productApi.getAll(ctx.token!, tenantId || ctx.tenantId)
        return res.data
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        throw new GraphQLError(
          axiosErr?.response?.data?.message || 'Failed to fetch products',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } },
        )
      }
    },

    product: async (
      _: unknown,
      { id, tenantId }: { id: string; tenantId?: string },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHORIZED' } })
      }
      try {
        const res = await productApi.getById(id, ctx.token!, tenantId || ctx.tenantId)
        return res.data
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
        if (axiosErr?.response?.status === 404) {
          throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } })
        }
        throw new GraphQLError('Failed to fetch product', { extensions: { code: 'INTERNAL_SERVER_ERROR' } })
      }
    },
  },
}
