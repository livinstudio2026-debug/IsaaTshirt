import { Navigate, Route, Routes } from 'react-router-dom'
import AdminAuthProvider from './AdminAuthProvider'
import RequireAdmin from './RequireAdmin'
import AdminLayout from './AdminLayout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import PackingSlip from './pages/PackingSlip'
import Products from './pages/Products'
import ProductEdit from './pages/ProductEdit'
import ProductPlacements from './pages/ProductPlacements'
import Inbox from './pages/Inbox'
import Reels from './pages/Reels'
import Team from './pages/Team'
import Account from './pages/Account'

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route element={<RequireAdmin />}>
          {/* the packing slip is a clean printable page: no back-office chrome */}
          <Route path="/admin/orders/:number/slip" element={<PackingSlip />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Overview />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/orders/:number" element={<OrderDetail />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/products/new" element={<ProductEdit />} />
            <Route path="/admin/products/placements" element={<ProductPlacements />} />
            <Route path="/admin/products/:slug" element={<ProductEdit />} />
            <Route path="/admin/inbox" element={<Inbox />} />
            <Route path="/admin/reels" element={<Reels />} />
            <Route path="/admin/team" element={<Team />} />
            <Route path="/admin/account" element={<Account />} />
          </Route>
        </Route>
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  )
}
