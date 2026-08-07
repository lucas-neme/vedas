import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InvoiceDetailPage } from '@/pages/InvoiceDetailPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { LoginPage } from '@/pages/LoginPage';
import { PosPage } from '@/pages/PosPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ReceivablesPage } from '@/pages/ReceivablesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SaleDetailPage } from '@/pages/SaleDetailPage';
import { SalesPage } from '@/pages/SalesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StockPage } from '@/pages/StockPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { UsersPage } from '@/pages/UsersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Carregando sessão..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicOnly>
                      <LoginPage />
                    </PublicOnly>
                  }
                />
                <Route element={<ProtectedRoutes />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="pdv" element={<PosPage />} />
                  <Route path="vendas" element={<SalesPage />} />
                  <Route path="vendas/:id" element={<SaleDetailPage />} />
                  <Route path="notas-fiscais" element={<InvoicesPage />} />
                  <Route path="notas-fiscais/:id" element={<InvoiceDetailPage />} />
                  <Route path="recebimentos" element={<ReceivablesPage />} />
                  <Route path="clientes" element={<CustomersPage />} />
                  <Route path="clientes/:id" element={<CustomerDetailPage />} />
                  <Route path="produtos" element={<ProductsPage />} />
                  <Route path="estoque" element={<StockPage />} />
                  <Route path="fornecedores" element={<SuppliersPage />} />
                  <Route path="categorias" element={<CategoriesPage />} />
                  <Route path="relatorios" element={<ReportsPage />} />
                  <Route path="configuracoes" element={<SettingsPage />} />
                  <Route path="usuarios" element={<UsersPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}
