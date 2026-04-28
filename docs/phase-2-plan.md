# Phase 2 — Frontend (Human UI)

Strict-scope plan. Mirrors the Phase 1 discipline: every line of work is in one of the tasks below; everything else is explicitly **not** Phase 2.

## Goal

Ship a four-page React dApp (`/create`, `/balance`, `/buy`, `/return`) talking directly to the deployed `AgentAccessPass` contract on Sepolia, with three role-distinct logic paths on the balance page (Agent, Doorman, Venue). Visual direction: **onchain-utility, mono-forward**. No backend, no event indexer.

## Locked decisions (resolved earlier this session)

| Choice                     | Resolution                                                    |
| -------------------------- | ------------------------------------------------------------- |
| Stack                      | Vite + React 18 + TypeScript strict                           |
| Styling                    | Tailwind CSS 3 + shadcn/ui primitives (New York, zinc base)   |
| State                      | `useState` only — no Redux/Zustand/global Context-as-state    |
| Routing                    | React Router v6, multi-route SPA                              |
| Wallet flow                | Page 1 generates and downloads keystore; user manually imports into MetaMask; Pages 3/4 consume MetaMask |
| Venue role detail          | Summary stats only — no holder enumeration, no event scanning |
| Visual direction           | Mono-forward (JetBrains Mono primary), zinc + single emerald accent, sharper radius (4px), 1px borders, dense rhythm |
| Animation                  | framer-motion only — no Reactbits                             |
| Repo location              | `ticketing_dapp/frontend/` subdirectory                       |
| Contract address source    | Imported from `deployments/sepolia.json`; ABI imported from `out/AgentAccessPass.sol/AgentAccessPass.json` |
| ethers version             | v6                                                            |
| Read RPC                   | `VITE_SEPOLIA_RPC_URL` from `.env.local`                      |
| Network mismatch           | Show "Switch to Sepolia" button calling `wallet_switchEthereumChain` |

Inherited from project memory:
- Atomic commits per logical task — no "phase done" blobs.
- Deployed contract address: `0x2FA94Dd1d27D2EF8CB906297E4280BEe0478ca1F` (Sepolia).

## Final layout

```
ticketing_dapp/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json
│   ├── postcss.config.js
│   ├── index.html
│   ├── .env.example
│   ├── .env.local              (gitignored)
│   ├── .gitignore
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx             (Router + ThemeProvider)
│   │   ├── index.css           (design tokens + Tailwind base)
│   │   ├── lib/
│   │   │   ├── contract.ts     (ABI + address + getReadContract / getWriteContract)
│   │   │   ├── wallet.ts       (connect, switchToSepolia, watch chain/account)
│   │   │   ├── format.ts       (wei → eth, address truncate, etc.)
│   │   │   └── utils.ts        (cn helper)
│   │   ├── components/
│   │   │   ├── ui/             (shadcn primitives — committed)
│   │   │   ├── nav.tsx         (56px sticky top nav)
│   │   │   ├── theme-provider.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   ├── address-chip.tsx (truncated 0xA1b2…F9c4 with copy)
│   │   │   ├── tx-status.tsx   (pending / confirmed / failed strip)
│   │   │   └── connect-bar.tsx (MetaMask connect + chain status)
│   │   ├── pages/
│   │   │   ├── Create.tsx
│   │   │   ├── Balance.tsx
│   │   │   ├── Buy.tsx
│   │   │   └── Return.tsx
│   │   └── abi/
│   │       └── AgentAccessPass.json   (copied from ../out/ at build time)
```

## Design tokens (paste into `src/index.css`)

The playbook tokens, modified for the locked direction:

- `--radius` becomes `0.25rem` (sharper, "tool-like").
- Accent stays `--primary` semantic name but holds **emerald** instead of indigo:
  - light: `--primary: 160 84% 39%` (emerald-600)
  - dark:  `--primary: 158 64% 52%` (emerald-400)
- `--ring` mirrors `--primary`.
- Other tokens remain zinc per the playbook.
- Reserve `rose-500` for `--destructive`.

Fonts:
- JetBrains Mono = primary (headings, data, addresses).
- Inter = secondary, only for prose where mono is too rigid.
- Both loaded via `<link rel="preconnect">` + `<link>` from Google Fonts in `index.html` (Vite has no `next/font` analog).

Dark mode default, light mode parity, theme toggle in nav.

## Per-page composition

### `/create` — Wallet creation

- Header: `WALLET // create` (mono, lowercase emphasis).
- Single card. Two visual states:
  - **Empty:** centered "Generate new" button with one-sentence explanation. Mono caption: `// keys are generated and held in this tab only — refresh wipes them`.
  - **Generated:** rows of `label: value` with mono values:
    - `address` → `<AddressChip>` (truncated + copy)
    - `private_key` → masked dots, "reveal" toggle
    - `status` → `unlocked · in-memory only` (subtle emerald dot)
  - Action row: `[ Generate new ]` (secondary), `[ Download keystore ]` (primary).
- Download flow: dialog asks for password, then `ethers.Wallet.encrypt(password)` → blob → download as `agent-pass-{address-slice}.json`.
- No persistence; refreshing or navigating away discards the wallet.

### `/balance` — Balance check (three role tabs)

- Header: `BALANCE // verify`.
- shadcn `Tabs` with three role panes. Each pane is a genuinely distinct query path, not a relabel:

  **Agent** (own balance)
  - Address input, default empty.
  - Button "Use connected wallet" if MetaMask is connected — fills input with `signer.getAddress()`.
  - On submit (or address change): one `provider.getBalance(addr)` + one `pass.balanceOf(addr)`.
  - Display: SETH balance and AAP balance as two stat lines, mono.

  **Doorman** (verification)
  - Address input + min-quantity input (default 1).
  - On submit: `pass.verifyHolder(addr, minQty)` (boolean).
  - Display: a single bold result block — emerald `verified` or rose `not verified` — plus the underlying `balanceOf` for context.

  **Venue** (distribution stats)
  - Read-only on mount (no input).
  - Parallel reads:
    - `pass.totalSupply()`
    - `pass.maxSupply()`
    - `pass.ticketPrice()`
    - `provider.getBalance(contractAddress)`
  - Derived: `reserved = totalSupply * ticketPrice`, `free = balance - reserved`.
  - Display: 5 stat tiles in a `grid grid-cols-2 md:grid-cols-3` — total supply, max supply, ticket price (SETH), contract balance (SETH), free balance (SETH).
  - Refresh button (manual; no polling).

All three panes use the read-only RPC provider. No MetaMask required to use the balance page.

### `/buy` — Purchase

- Header: `PURCHASE // pass`.
- `<ConnectBar>` at top: shows connection state and Sepolia chain check; renders "Connect MetaMask" or "Switch to Sepolia" if needed.
- Form: quantity input (integer, default 1, min 1, max derived from `maxSupply - totalSupply`).
- Live computed cost: `quantity × ticketPrice` shown in mono SETH.
- Submit button: `Buy {quantity} pass(es) for {cost} SETH`.
- On click:
  1. Call `pass.purchaseTicket(quantity, { value: cost })`.
  2. Show pending strip with tx hash (truncated, link to Sepolia Etherscan).
  3. On confirmation, swap to confirmed strip with block number.
  4. On revert, parse the require string and surface the canonical AAP error inline (`AAP: incorrect payment`, etc.).
- Disabled state: form disabled if not connected or wrong network.

### `/return` — Transfer back

- Header: `RETURN // pass`.
- Same `<ConnectBar>` and form pattern as `/buy`.
- Quantity bounded by the connected wallet's `pass.balanceOf(signer)`.
- Submit calls `pass.returnTicket(quantity)`.
- Same tx-status flow.

### Shared nav

```
AAP · agent access pass     [create] [balance] [buy] [return]      ●dark
─────────────────────────────────────────────────────────────────────────
```

- 56 px sticky, `border-b`, `bg-background/80 backdrop-blur`.
- Active route link: `text-foreground`, others `text-muted-foreground`.
- ConnectBar lives **inside** `/buy` and `/return` page bodies, not in the global nav, so the read-only pages don't push wallet UX.

## Tasks

### T1 — Frontend project init
- `cd frontend && npm create vite@latest` → React + TS template.
- Install: tailwind 3, postcss, autoprefixer, react-router-dom, ethers v6, framer-motion, lucide-react, class-variance-authority, clsx, tailwind-merge, @radix-ui/react-* (for shadcn primitives).
- `npx shadcn@latest init` with zinc base, CSS variables, New York style.
- Configure `tsconfig.json` path alias `@/* → src/*`.
- Configure `tailwind.config.ts` with zinc color extensions and JetBrains Mono / Inter font families.
- `.env.example` with `VITE_SEPOLIA_RPC_URL`.
- `.gitignore` for node_modules, dist, .env.local.
- **Exit:** `npm run dev` serves a blank Vite welcome page; `npm run build` clean.

### T2 — Design tokens + base layout
- Paste tokens into `src/index.css` (mono-forward, emerald accent, sharper radius).
- Load JetBrains Mono + Inter via `index.html`.
- Add `theme-provider.tsx` and `theme-toggle.tsx` (next-themes-style for Vite, simple useState + localStorage).
- Set up `App.tsx` with Router + ThemeProvider + nav scaffold + `<Outlet />`.
- Add `lib/utils.ts` with `cn`.
- Install shadcn primitives: `button`, `card`, `input`, `label`, `tabs`, `dialog`, `separator`, `badge`.
- **Exit:** Visiting `/` shows the nav with placeholder pages, dark/light toggle works.

### T3 — Shared lib (contract, wallet, format)
- `lib/contract.ts`: import deployed address from `../../deployments/sepolia.json`, ABI from `src/abi/AgentAccessPass.json` (copied via a small script or manual paste). Expose `getReadContract()` (uses RPC provider), `getWriteContract(signer)`.
- `lib/wallet.ts`: `connect()`, `switchToSepolia()`, `watchAccountChanges(cb)`, `watchChainChanges(cb)`. Wraps `window.ethereum`. Returns typed shape.
- `lib/format.ts`: `truncateAddress(0xabc…)`, `formatEth(bigint)`, `formatWei(bigint)`, `parseQuantity(string)`.
- **Exit:** Manual smoke in browser console: `getReadContract().then(c => c.totalSupply())` returns the on-chain value.

### T4 — Reusable components
- `<AddressChip>`: truncated mono address with copy-to-clipboard.
- `<ConnectBar>`: connection + chain banner, three states (disconnected, wrong-network, ready).
- `<TxStatus>`: idle / pending / confirmed / failed with framer-motion fade.
- `<StatTile>`: label + big mono value + optional caption.
- **Exit:** Storybook-style page at `/dev` (gated by `import.meta.env.DEV`) renders all four in their states.

### T5 — Page 1 `/create`
- Empty / generated state machine via `useState`.
- Generate: `ethers.Wallet.createRandom()`.
- Reveal toggle for private key.
- Download flow: shadcn `Dialog` for password input → `wallet.encrypt(password)` → trigger download.
- **Exit:** Generates a wallet, downloads a valid keystore that `ethers.Wallet.fromEncryptedJson` can re-decrypt.

### T6 — Page 2 `/balance` (three role tabs)
- shadcn `Tabs` with `agent`, `doorman`, `venue` panes.
- Agent pane: address input, "use connected" button, parallel `getBalance` + `balanceOf`.
- Doorman pane: address + min-quantity inputs, `verifyHolder` call, emerald/rose result block.
- Venue pane: parallel reads on mount, 5-tile stat grid, manual refresh button.
- **Exit:** Each pane reads from Sepolia mainnet contract via the read RPC, renders correctly. Each pane has a genuinely distinct call shape — verifiable in DevTools network tab.

### T7 — Page 3 `/buy`
- Form + connect-bar.
- Live cost computation.
- Submit → `purchaseTicket{value}` → `<TxStatus>` updates.
- Revert handling: parse require string from error data, show `AAP: …` reason inline.
- **Exit:** Live purchase against Sepolia contract from a non-venue wallet succeeds end-to-end.

### T8 — Page 4 `/return`
- Mirrors `/buy` shape; calls `returnTicket`.
- Quantity max derived from connected wallet's `balanceOf`.
- **Exit:** Live return against the contract refunds SETH, emits TicketReturned, status strip confirms.

### T9 — Polish + Playwright UI verification
- Use the `playwright` MCP browser tools to load `/create`, `/balance`, `/buy`, `/return` against the running dev server. Verify:
  - Dark/light parity (no white-rectangle figures, no contrast failures).
  - `/balance` venue tab actually reads on-chain values (totalSupply > 0 if smoke-test purchases happened).
  - `/create` keystore downloads and is decryptable.
  - Empty / loading / error states render coherently.
- Accessibility quick pass: focus states on all buttons, keyboard tab order coherent.
- Responsive: 360px / 768px / 1280px breakpoints — no horizontal scroll, no overlapping text.
- Update `CLAUDE.md` status.

## Non-goals (explicitly out of Phase 2)

- WalletConnect, RainbowKit, Web3Modal — only injected MetaMask.
- Server-side rendering — pure SPA.
- Backend, DB, auth, user accounts.
- Event indexing or holder enumeration.
- Multi-chain support — Sepolia only.
- Production deployment (Vercel/Netlify) — local `npm run dev` is the bar; Phase 3+ can publish.
- Internationalization, RTL.
- Persistent wallet storage in localStorage — wallet exists in tab memory only.
- Push notifications, polling, or websocket subscriptions for tx status — single `wait()` is enough.
- Custom design system docs — tokens live in `index.css`, that's the source of truth.

## Risks / what to watch

- **ABI sync.** `src/abi/AgentAccessPass.json` is copied from `out/`. Drift if the contract is redeployed — make T3 include a `npm run sync-abi` script that copies from `../out/AgentAccessPass.sol/AgentAccessPass.json` so it's a one-command refresh.
- **Vite env var visibility.** `VITE_*` vars are bundled into the client. The Sepolia RPC URL becomes public. That's expected for a read-only key but worth documenting in `.env.example`.
- **MetaMask injection race.** `window.ethereum` may not be defined immediately. Use the `ethereum#initialized` event or a small polling check before declaring "no wallet detected".
- **EIP-1193 network change handling.** When the user switches chains in MetaMask mid-session, all UI that reads `signer` becomes stale. Subscribe to `chainChanged` and re-render.
- **revert-reason decoding.** OZ v5 mixes custom errors (`ReentrancyGuardReentrantCall`) with our `require` strings. ethers v6 surfaces both differently. T7 needs explicit decoding for both shapes so the user sees `AAP: incorrect payment` rather than a hex blob.
- **CORS on Sepolia public RPC.** Browser fetches from a public RPC may be CORS-blocked. Use Alchemy/Infura (which support CORS) rather than `https://rpc.sepolia.org`.

## What I need before starting execution

Your ratification of this plan, or amendments. Then T1 → T9 in order, atomic commit per task.
