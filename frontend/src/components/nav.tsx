import { Link, useLocation } from "react-router-dom"

import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const links = [
  { to: "/create", label: "create" },
  { to: "/balance", label: "balance" },
  { to: "/buy", label: "buy" },
  { to: "/return", label: "return" },
] as const

export function Nav() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="text-sm font-medium tracking-tight">
          AAP <span className="text-muted-foreground"> · agent access pass</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {links.map((link) => {
            const active = pathname === link.to || (link.to === "/create" && pathname === "/")
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-sm px-3 py-1.5 transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
