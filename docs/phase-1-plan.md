# Phase 1 — Smart Contract Specification

Strict-scope plan. No work is done outside the tasks below. Anything not on this list is explicitly **not** in Phase 1.

## Goal

Deliver a single, audited-quality Solidity contract (`AgentAccessPass`) that implements the ERC-20 base + ticketing extensions defined in `CLAUDE.md`, with a written spec, full unit + invariant test coverage, and a Sepolia deploy script ready to run.

## Final layout

```
ticketing_dapp/
├── CLAUDE.md                          # already exists — project scope
├── foundry.toml                       # Foundry config
├── remappings.txt                     # OZ import paths
├── .env.example                       # documented env vars
├── .gitignore
├── docs/
│   ├── phase-1-plan.md                # this file
│   └── contract-spec.md               # written contract spec (T2)
├── src/
│   └── AgentAccessPass.sol            # the contract (T3)
├── test/
│   ├── AgentAccessPass.t.sol          # unit tests (T4)
│   ├── AgentAccessPass.invariant.t.sol# invariant test + handler (T5)
│   └── mocks/
│       └── ReentrantAttacker.sol      # for reentrancy unit tests
├── script/
│   └── Deploy.s.sol                   # Sepolia deploy script (T6)
└── lib/
    ├── forge-std/
    └── openzeppelin-contracts/
```

## Tasks

### T1 — Foundry project initialization
- `git init` (forge install uses submodules, so a repo is required).
- `forge init --no-commit --no-git` against the existing dir, then add forge-std manually if needed; OR run `forge init` in a temp path and copy in. Goal: get `lib/forge-std/`, `foundry.toml`, `.gitignore`.
- `forge install OpenZeppelin/openzeppelin-contracts --no-commit`.
- Pin OZ to a v5.x release tag so builds are reproducible.
- `foundry.toml`: `solc = "0.8.24"`, `optimizer = true`, `optimizer_runs = 200`, `evm_version = "paris"` (Sepolia-safe), `fuzz = { runs = 256 }`, `invariant = { runs = 64, depth = 32, fail_on_revert = false }`.
- `remappings.txt`: `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`.
- `.gitignore`: cache/, out/, broadcast/, .env, node_modules/.
- Verify with `forge build` on an empty `src/` (should succeed with nothing to compile).

**Exit criteria:** `forge build` exits 0; `forge test` exits 0 (no tests yet).

### T2 — Written contract spec
- `docs/contract-spec.md` — the source-of-truth document the contract is checked against.
- Sections: token metadata, immutable state, function signatures with full pre/post conditions, events with field semantics, all revert reason strings, the core invariant, security patterns (CEI, reentrancy, no `receive()`), out-of-scope items.
- This is what an auditor would read first. Keep it precise — every revert string and event field listed.

**Exit criteria:** doc covers every function and every revert path. No "TBD" left.

### T3 — Implement `AgentAccessPass.sol`
- Pragma `^0.8.24`. Imports `ERC20`, `ReentrancyGuard` from OZ v5.
- Constructor: `constructor(uint256 _ticketPrice, uint256 _maxSupply) ERC20("Agent Access Pass", "AAP")`. Sets `ticketPrice`, `maxSupply` (immutable), `venue = msg.sender` (immutable).
- Override `decimals()` to return `0`.
- `purchaseTicket(uint256 quantity) external payable nonReentrant`:
  1. `require(quantity > 0, "AAP: quantity zero")`
  2. `require(totalSupply() + quantity <= maxSupply, "AAP: exceeds max supply")`
  3. `require(msg.value == quantity * ticketPrice, "AAP: incorrect payment")`
  4. `_mint(msg.sender, quantity)` (effects)
  5. emit `TicketPurchased(msg.sender, quantity, msg.value)`
  6. No external interaction — funds remain in contract.
- `returnTicket(uint256 quantity) external nonReentrant`:
  1. `require(quantity > 0, "AAP: quantity zero")`
  2. `require(balanceOf(msg.sender) >= quantity, "AAP: insufficient balance")` (also enforced by `_burn`, but explicit string is clearer)
  3. `_burn(msg.sender, quantity)` (effects)
  4. `uint256 refund = quantity * ticketPrice;`
  5. emit `TicketReturned(msg.sender, quantity, refund)` (event before interaction is fine; CEI is about state, not events)
  6. `(bool ok, ) = msg.sender.call{value: refund}(""); require(ok, "AAP: refund failed");`
- `verifyHolder(address wallet, uint256 minQuantity) external view returns (bool)`:
  - `return balanceOf(wallet) >= minQuantity;`
- `withdraw() external nonReentrant`:
  1. `require(msg.sender == venue, "AAP: only venue")`
  2. `uint256 reserved = totalSupply() * ticketPrice;`
  3. `uint256 free = address(this).balance - reserved;`
  4. `require(free > 0, "AAP: no free balance")`
  5. emit `Withdrawn(venue, free)`
  6. `(bool ok, ) = venue.call{value: free}(""); require(ok, "AAP: withdraw failed");`
- No `receive()` / `fallback()`.

**Exit criteria:** `forge build` clean. Code matches the spec doc exactly (every revert string, every event field).

### T4 — Unit tests (`AgentAccessPass.t.sol`)

Foundry tests using `forge-std/Test.sol`. Cases (each one its own `test_*` function):

Constructor / metadata:
- name/symbol/decimals correct
- ticketPrice, maxSupply, venue set correctly

`purchaseTicket`:
- happy path: balance, totalSupply, contract balance update; event emitted
- reverts: zero quantity; wrong msg.value (under and over); exceeds maxSupply; exact-cap purchase succeeds, +1 reverts

`returnTicket`:
- happy path: burn, contract balance shrinks, caller refunded; event emitted
- reverts: zero quantity; balance too low; refund recipient that rejects ETH (use a contract with no `receive()`) → revert with "AAP: refund failed", **state preserved** (balance and supply unchanged after revert)

`verifyHolder`:
- true when balance ≥ min; false otherwise; true for minQuantity == 0 (always)

`withdraw`:
- happy path: venue receives free balance; reserve preserved; event emitted
- reverts: non-venue caller; free balance is zero; called when totalSupply × ticketPrice == address(this).balance

Reentrancy (using `test/mocks/ReentrantAttacker.sol`):
- attacker contract whose `receive()` calls back into `returnTicket` → second call reverts via guard, top-level tx still completes normally
- attacker that re-enters `purchaseTicket` from inside `returnTicket` callback → guard blocks

ERC-20 standard behavior (lightweight — OZ already tested):
- transfer between two wallets succeeds
- approve + transferFrom succeeds
- one assertion confirming `verifyHolder` reflects post-transfer state (sanity check)

**Exit criteria:** `forge test -vvv` all green.

### T5 — Invariant tests (`AgentAccessPass.invariant.t.sol`)

Handler contract that randomly invokes `purchaseTicket` (with bounded quantity & matching value), `returnTicket`, `withdraw`, plus ERC-20 transfers between a small actor pool. Cap quantities so we don't fuzz into uint256 overflow noise.

Invariants asserted:
1. **Solvency:** `address(this).balance >= totalSupply() * ticketPrice`. (The load-bearing one.)
2. **Cap:** `totalSupply() <= maxSupply`.
3. **Sum-of-balances:** sum across actor pool equals `totalSupply()`.

Run with default `runs = 64, depth = 32` from foundry.toml; set `fail_on_revert = false` so handler-level reverts (e.g., insufficient balance) don't fail the run.

**Exit criteria:** `forge test --match-contract Invariant -vvv` all green across multiple seeds.

### T6 — Sepolia deploy script (`script/Deploy.s.sol`)

- Reads from env: `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `TICKET_PRICE_WEI`, `MAX_SUPPLY`, `ETHERSCAN_API_KEY`.
- `vm.startBroadcast(deployerPrivateKey); new AgentAccessPass(ticketPrice, maxSupply); vm.stopBroadcast();`
- `console2.log` the deployed address.
- The script **compiles** in Phase 1; actually broadcasting to Sepolia is the user's call (out of scope — see non-goals).

**Exit criteria:** `forge build` clean. Dry-run via `forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL` (without `--broadcast`) succeeds locally if a Sepolia RPC is available; otherwise just compile-clean is the bar.

### T7 — `.env.example` + brief README section

`.env.example`:
```
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
ETHERSCAN_API_KEY=
TICKET_PRICE_WEI=
MAX_SUPPLY=
```

Add a "Build / Test / Deploy" section to `docs/contract-spec.md` (not a separate README) with the exact `forge build`, `forge test`, `forge script ... --broadcast --verify` invocations.

**Exit criteria:** file present; commands in spec doc are copy-paste runnable.

### T8 — Phase verification

- `forge build` clean.
- `forge test -vvv` all green (unit + invariant).
- Confirm spec doc and contract are aligned: every revert string in the contract appears verbatim in the spec doc, and every spec doc claim is testable.
- Update `CLAUDE.md` status to mark Phase 1 complete.

**Exit criteria:** all of the above check out; nothing in `out/` warns or errors.

## Non-goals (explicitly out of Phase 1)

- Actually deploying to Sepolia (script is ready, deployment is yours to trigger).
- Frontend / Human UI.
- Programmatic agent demo.
- Multi-tier ticket types, dynamic pricing, role-based access control beyond venue-only `withdraw`.
- Pausability, upgrades, ownership transfer.
- Custom errors (user spec says reason strings — kept).
- Gas optimization beyond default optimizer settings.
- External audit.
- Mainnet deploy.

## Risks I'll watch during execution

- **Submodule cleanliness.** `forge install` adds submodules; if `git init` is skipped, install will fail. Task T1 handles this.
- **`fail_on_revert` for invariant tests.** Setting it `false` prevents handler-level reasonable reverts from killing the run, but I'll still assert that the *invariants themselves* never fail. This is the standard pattern.
- **OZ v5 API.** OZ v5 changed some internal hooks (`_update` replaced `_beforeTokenTransfer`/`_afterTokenTransfer`). For our contract we don't override transfer hooks, so this is no impact, but I'll verify imports compile against the pinned OZ tag rather than assuming.

## What I need before starting execution

Your ratification of this plan as-is, or amendments. Once ratified I'll work T1 → T8 in order.
