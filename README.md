# Ticketing dApp

ERC-20 access passes for **service-consuming agents**. Within a tier, tickets are fungible — that's the right shape for "agent X holds N passes for service Y."

Three layers, built in phases:

1. **Smart contract** — `AgentAccessPass` (AAP), `decimals = 0`, OpenZeppelin ERC-20 + ReentrancyGuard. *(Phase 1 — done)*
2. **Human UI** — Vite + React frontend for create / buy / hold / return. *(Phase 2 — done)*
3. **Programmatic agent demo** — agent purchase + service-side `verifyHolder`. *(Phase 3 — not yet planned)*

Full spec: [`docs/contract-spec.md`](docs/contract-spec.md). Project rules and phase status: [`CLAUDE.md`](CLAUDE.md).

## Live deployment (Sepolia)

| | |
|---|---|
| Contract | [`0x2FA94Dd1d27D2EF8CB906297E4280BEe0478ca1F`](https://sepolia.etherscan.io/address/0x2FA94Dd1d27D2EF8CB906297E4280BEe0478ca1F#code) |
| Ticket price | `0.001 SETH` |
| Max supply | `1000` |
| Venue / deployer | `0x4fCD7551119f6f9156aAf2aA2E569ebA8CE86d2e` |

Source is verified on Etherscan. Full deployment metadata: [`deployments/sepolia.json`](deployments/sepolia.json).

## Repo layout

```
src/                AgentAccessPass.sol
test/               unit + invariant tests (Foundry)
script/             Deploy.s.sol
docs/               contract spec + per-phase plans
deployments/        on-chain deployment records
frontend/           Vite + React UI (see frontend/README.md)
```

## Contract surface

```solidity
purchaseTicket(uint256 quantity) payable    // mint, escrow SETH in contract
returnTicket(uint256 quantity)              // burn, refund quantity * ticketPrice
verifyHolder(address w, uint256 minQty)     // doorman check, view
withdraw()                                  // venue-only, free balance only
```

Core invariant: `address(this).balance >= totalSupply() * ticketPrice` — refunds are always solvent without external dependencies.

## Build & test

Requires [Foundry](https://book.getfoundry.sh/) (tested with `1.6.0-rc1`).

```bash
forge install        # pulls OpenZeppelin + forge-std submodules
forge build
forge test           # 27 unit + 3 invariant (64 runs × 32 depth)
```

## Deploy

Copy `.env.example` → `.env` and fill `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `TICKET_PRICE_WEI`, `MAX_SUPPLY`. The deployer becomes the immutable `venue`.

```bash
forge script script/Deploy.s.sol \
  --rpc-url sepolia --broadcast --verify
```

## Frontend

```bash
cd frontend
npm install
npm run dev          # also runs `sync` to pull ABI from out/ + address from deployments/
```

Routes: `/create` (generate wallet + V3 keystore), `/balance` (agent / doorman / venue tabs), `/buy`, `/return`. To talk to Sepolia, set `VITE_SEPOLIA_RPC_URL` in `frontend/.env.local`.
