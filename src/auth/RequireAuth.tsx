import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Flex, Spinner } from '@chakra-ui/react'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
