import { lazy, useEffect, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupNeeded } from '@/features/setup/SetupNeeded'
import { Flex, Spinner } from '@chakra-ui/react'
import { isFirebaseConfigured } from '@/lib/firebase'

// Code-split the feature pages so the initial load stays small (the dashboard
// pulls in the charting library, which we don't want in the first bundle).
//
// The three the owner actually opens every day keep a named loader so they can
// also be fetched ahead of time — see the prefetch below.
const loadHome = () => import('@/features/home/HomePage')
const loadCaisse = () => import('@/features/pos/CaissePage')
const loadStock = () => import('@/features/stock/StockPage')
const loadCatalog = () => import('@/features/catalog/CatalogPage')

const HomePage = lazy(() => loadHome().then((m) => ({ default: m.HomePage })))
const CaissePage = lazy(() => loadCaisse().then((m) => ({ default: m.CaissePage })))
const StockPage = lazy(() => loadStock().then((m) => ({ default: m.StockPage })))
const CatalogPage = lazy(() => loadCatalog().then((m) => ({ default: m.CatalogPage })))
const InvoicesPage = lazy(() =>
  import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
)
const CreditPage = lazy(() =>
  import('@/features/credit/CreditPage').then((m) => ({ default: m.CreditPage })),
)
const CustomerDetailPage = lazy(() =>
  import('@/features/credit/CustomerDetailPage').then((m) => ({
    default: m.CustomerDetailPage,
  })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const PacksPage = lazy(() =>
  import('@/features/packs/PacksPage').then((m) => ({ default: m.PacksPage })),
)
const SuppliersPage = lazy(() =>
  import('@/features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const BackupPage = lazy(() =>
  import('@/features/backup/BackupPage').then((m) => ({ default: m.BackupPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function PageFallback() {
  return (
    <Flex justify="center" py={20}>
      <Spinner size="xl" colorPalette="brand" />
    </Flex>
  )
}

/**
 * Everything one routed page needs: its loading spinner while the chunk arrives,
 * and its own error boundary.
 *
 * The boundary is INSIDE AppShell (these elements render into its `<Outlet/>`),
 * which is the whole point: a page that throws leaves the navigation on screen,
 * so the owner can walk to another screen instead of looking at a dead app. It
 * wraps the Suspense rather than sitting under it, because a `lazy()` import
 * that fails to download surfaces as a throw from the suspended tree — that is
 * the missing-chunk case from a service worker installed over a flaky line, and
 * it has to be caught here.
 *
 * The key is load-bearing. React Router renders the matched route's element in
 * the same position in the tree, and these elements are all the same component
 * type, so React reuses this instance across a navigation — a boundary stuck in
 * its error state would follow the owner to every page he tried. Keying on the
 * path remounts it, which is exactly the "walk away from the broken screen"
 * recovery this exists to give him.
 */
function PageBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname} where={`route${location.pathname}`}>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export function App() {
  /**
   * Warm the till in the background as soon as the browser is idle. Opening the
   * caisse is the first thing that happens every morning, and waiting for its
   * chunk to download with a customer already at the counter is exactly the
   * pause the shop feels. Fetched at idle so it never competes with the first
   * paint, and errors are ignored — this is only ever an optimisation.
   */
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const warm = () => {
      void loadCaisse().catch(() => {})
      void loadHome().catch(() => {})
      void loadStock().catch(() => {})
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(warm, 1500)
    return () => window.clearTimeout(id)
  }, [])

  // Before the owner pastes their Firebase config, show a setup screen
  // instead of a blank crash.
  if (!isFirebaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={
                <PageBoundary>
                  <HomePage />
                </PageBoundary>
              }
            />
            <Route
              path="/caisse"
              element={
                <PageBoundary>
                  <CaissePage />
                </PageBoundary>
              }
            />
            <Route
              path="/catalog"
              element={
                <PageBoundary>
                  <CatalogPage />
                </PageBoundary>
              }
            />
            <Route
              path="/stock"
              element={
                <PageBoundary>
                  <StockPage />
                </PageBoundary>
              }
            />
            <Route
              path="/packs"
              element={
                <PageBoundary>
                  <PacksPage />
                </PageBoundary>
              }
            />
            <Route
              path="/invoices"
              element={
                <PageBoundary>
                  <InvoicesPage />
                </PageBoundary>
              }
            />
            <Route
              path="/suppliers"
              element={
                <PageBoundary>
                  <SuppliersPage />
                </PageBoundary>
              }
            />
            <Route
              path="/credit"
              element={
                <PageBoundary>
                  <CreditPage />
                </PageBoundary>
              }
            />
            <Route
              path="/credit/:id"
              element={
                <PageBoundary>
                  <CustomerDetailPage />
                </PageBoundary>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PageBoundary>
                  <DashboardPage />
                </PageBoundary>
              }
            />
            <Route
              path="/reports"
              element={
                <PageBoundary>
                  <ReportsPage />
                </PageBoundary>
              }
            />
            <Route
              path="/backup"
              element={
                <PageBoundary>
                  <BackupPage />
                </PageBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <PageBoundary>
                  <SettingsPage />
                </PageBoundary>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
