import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"

import { Nav } from "@/components/nav"
import { ThemeProvider } from "@/components/theme-provider"
import Balance from "@/pages/Balance"
import Buy from "@/pages/Buy"
import Create from "@/pages/Create"
import Return from "@/pages/Return"

function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/create" replace />} />
            <Route path="/create" element={<Create />} />
            <Route path="/balance" element={<Balance />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/return" element={<Return />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
