export default function Balance() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">
          balance <span className="text-muted-foreground">// verify</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Three role-distinct query paths. Agent checks own balance, Doorman verifies a wallet, Venue inspects distribution.
        </p>
      </header>
      <p className="text-sm text-muted-foreground">// T6</p>
    </section>
  )
}
