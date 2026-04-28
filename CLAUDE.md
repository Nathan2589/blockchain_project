# Ticketing dApp — Project Scope

A ticketing dApp where access tokens are purchased and verified for **service-consuming agents** (not human attendees). ERC-20 is the right base because tickets within a single service tier are fungible.

The system has three layers, built in phases:
1. **Smart contract** — single Solidity contract, ERC-20 base + ticketing extensions.
2. **Human UI** — frontend for humans to purchase / hold / return tickets.
3. **Programmatic agent demo** — shows an agent purchasing a ticket and a service verifying holdership.

## Smart contract scope (this milestone)

Single contract. Solidity. Inherits from OpenZeppelin's `ERC20` and `ReentrancyGuard`.

### Token metadata
- Name: `"Agent Access Pass"`
- Symbol: `"AAP"`
- `decimals()` overridden to **0** — whole-ticket semantics, 1 token = 1 ticket.

### Immutable / construction-time state
- `ticketPrice` — price per ticket, in wei, set at construction (`immutable`).
- `venue` — the contract creator. Receives SETH revenue via withdrawal (`immutable`).
- `maxSupply` — cap on **outstanding** supply: `totalSupply() <= maxSupply` must hold post-mint. Returns burn tokens and free room for re-mint.

### Functions to add on top of ERC-20
- `purchaseTicket(uint256 quantity) payable` — `nonReentrant`
  - Requires `quantity > 0`, `msg.value == quantity * ticketPrice`, `totalSupply() + quantity <= maxSupply`.
  - Mints `quantity` tokens to `msg.sender`.
  - **SETH stays in the contract** (not forwarded). Venue pulls revenue via `withdraw()`.
- `returnTicket(uint256 quantity)` — `nonReentrant`
  - Requires `quantity > 0`, `balanceOf(msg.sender) >= quantity`.
  - Burns `quantity` tokens from `msg.sender`.
  - Sends `quantity * ticketPrice` SETH to `msg.sender` from the contract balance.
- `verifyHolder(address wallet, uint256 minQuantity) view returns (bool)`
  - True iff `balanceOf(wallet) >= minQuantity`. Binary doorman check.
- `withdraw()` — `nonReentrant`, venue-only
  - Sends the **free** contract balance to `venue`, where free = `address(this).balance - (totalSupply() * ticketPrice)`.
  - Preserves the invariant: contract balance is always ≥ what's needed to refund every outstanding ticket.
  - Reverts if free balance is zero.

No `receive()` / `fallback()` — ETH may only enter via `purchaseTicket`.

### Core invariant
`address(this).balance >= totalSupply() * ticketPrice` at the end of every external call. This makes returns always solvent without external dependencies.

### Events
- `TicketPurchased(address indexed buyer, uint256 quantity, uint256 amountPaid)`
- `TicketReturned(address indexed holder, uint256 quantity, uint256 amountRefunded)`
- `Withdrawn(address indexed venue, uint256 amount)` — emitted by `withdraw()` (added because `withdraw()` is a state-changing function and event coverage should be complete)
- Standard ERC-20 `Transfer` and `Approval` (inherited).

### Security patterns (required)
- `ReentrancyGuard` on `purchaseTicket` and `returnTicket`.
- Checks-Effects-Interactions ordering.
- Explicit `require` / revert messages with reason strings.

### Network
- SETH = Sepolia ETH. Target chain is Sepolia testnet.

## Working principles (set by user)

- Each phase is **scoped strictly to the tasks given**. No overbuilding, no speculative features.
- Resolve all ambiguity **before** execution. Planning may happen, implementation does not, until the spec is unambiguous.
- Prefer inheriting from battle-tested libraries (OpenZeppelin) over hand-rolling primitives.

## Phase 1 deliverable scope (resolved)

All of:
- Written spec doc (markdown) covering the contract surface, invariants, and security reasoning.
- The Solidity contract.
- Project scaffolding + unit tests covering happy paths, reverts, reentrancy, and the core invariant.
- Sepolia deploy script + `.env.example`.

Solidity pragma: `^0.8.24`. OpenZeppelin Contracts v5.x.

### Tooling (resolved)

- **Foundry** for build, tests, and deploy scripting. Chosen for invariant/fuzz testing fit — the contract has a load-bearing arithmetic invariant under reentrancy.
- Hardhat may come in alongside the frontend in a later phase; not used here.

## Status

- **Phase 1: Smart Contract Specification — COMPLETE.**
  - Spec doc: `docs/contract-spec.md` (canonical, 8 revert strings tracked in §8)
  - Contract: `src/AgentAccessPass.sol` (revert strings match spec verbatim)
  - Tests: 30 total — 27 unit + 3 invariant (64 runs × 32 depth)
  - Deploy: `script/Deploy.s.sol` + `.env.example`, dry-run verified, broadcast pending user trigger
  - Foundry 1.6.0-rc1, OZ v5.6.1 pinned, solc 0.8.24, EVM `paris`

## Next phases (not yet planned)

- Phase 2: Human UI (frontend)
- Phase 3: Programmatic agent demo
