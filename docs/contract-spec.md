# `AgentAccessPass.sol` — Contract Specification

Source-of-truth specification for the Phase 1 contract. The implementation in `src/AgentAccessPass.sol` MUST match this document exactly: every revert string verbatim, every event field, every pre/post condition. Any divergence is a bug in either the code or this doc — reconcile before merging.

---

## 1. Overview

`AgentAccessPass` is an ERC-20 token where each token represents one access pass for a service-consuming agent. Passes are **fungible within the contract** (one tier, one price). Holders are typically agent wallets; verification is binary (does this wallet hold ≥ N passes).

The contract is the custodian of unspent purchase funds. Funds enter only via `purchaseTicket`, are reserved against the obligation to refund any outstanding pass, and exit only via `returnTicket` (refund) or `withdraw` (venue revenue, capped at the unreserved balance).

The single load-bearing invariant — preserved across every external call — is:

> `address(this).balance >= totalSupply() * ticketPrice`

This guarantees every outstanding pass is always redeemable for its full purchase value, with no external dependency.

## 2. Inheritance & imports

```solidity
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentAccessPass is ERC20, ReentrancyGuard { ... }
```

OpenZeppelin Contracts v5.6.1, pinned via submodule.

## 3. Token metadata

| Field        | Value                |
| ------------ | -------------------- |
| `name()`     | `"Agent Access Pass"` |
| `symbol()`   | `"AAP"`              |
| `decimals()` | `0` (overridden)     |

`decimals()` is overridden to return `0` so that one token always represents exactly one pass. All `quantity` arguments are literal pass counts. This is a hard requirement of the verification model — `verifyHolder(wallet, 5)` must mean "five passes", not "five times 10¹⁸ smallest units".

## 4. State variables

All three are `immutable` — set once at construction and never changed.

| Name          | Type      | Visibility | Set in       | Meaning                                                    |
| ------------- | --------- | ---------- | ------------ | ---------------------------------------------------------- |
| `ticketPrice` | `uint256` | `public`   | constructor  | Price per pass, in wei. Constant for the contract's life.  |
| `venue`       | `address` | `public`   | constructor  | The deployer. Receives revenue via `withdraw()`.           |
| `maxSupply`   | `uint256` | `public`   | constructor  | Cap on **outstanding** supply. Burns free room for re-mint. |

There are no mutable contract-level state variables added on top of `ERC20`'s internal balance/supply tracking.

## 5. Constructor

```solidity
constructor(uint256 _ticketPrice, uint256 _maxSupply)
    ERC20("Agent Access Pass", "AAP")
```

**Preconditions:** none (callers may pass zero values; no reverts at construction). Zero `_ticketPrice` makes purchase free and refunds zero-valued — degenerate but valid. Zero `_maxSupply` permanently disables purchases.

**Effects:**
- `ticketPrice = _ticketPrice`
- `maxSupply = _maxSupply`
- `venue = msg.sender`

**Interactions:** none.

## 6. Functions

### 6.1 `purchaseTicket(uint256 quantity) external payable nonReentrant`

Buys `quantity` passes for the caller, paying `quantity * ticketPrice` wei.

**Preconditions, in evaluation order:**

| # | Check                                       | Revert reason                |
| - | ------------------------------------------- | ---------------------------- |
| 1 | `quantity > 0`                              | `"AAP: quantity zero"`       |
| 2 | `totalSupply() + quantity <= maxSupply`     | `"AAP: exceeds max supply"`  |
| 3 | `msg.value == quantity * ticketPrice`       | `"AAP: incorrect payment"`   |

**Effects (CEI: effects only, after all checks):**
- `_mint(msg.sender, quantity)` — caller balance +`quantity`, `totalSupply` +`quantity`.
- Contract ETH balance grows by `msg.value` (automatic from `payable`).

**Interactions:** none. Funds remain in the contract; venue pulls revenue separately via `withdraw`.

**Events:** `TicketPurchased(msg.sender, quantity, msg.value)` and the inherited `Transfer(address(0), msg.sender, quantity)`.

**Returns:** none.

**Notes:**
- The mismatch check `msg.value == quantity * ticketPrice` rejects both under- and over-payment. Over-payment is rejected (rather than refunded) to keep the function trivial and CEI-pure.
- `quantity * ticketPrice` cannot overflow in practice because check (2) bounds `quantity` to at most `maxSupply`, and the deployer is responsible for choosing `maxSupply * ticketPrice ≤ 2²⁵⁶ − 1` (for any plausible ticketing parameters this is comfortable).

### 6.2 `returnTicket(uint256 quantity) external nonReentrant`

Burns `quantity` passes from the caller and refunds `quantity * ticketPrice` wei to the caller.

**Preconditions, in evaluation order:**

| # | Check                                  | Revert reason                |
| - | -------------------------------------- | ---------------------------- |
| 1 | `quantity > 0`                         | `"AAP: quantity zero"`       |
| 2 | `balanceOf(msg.sender) >= quantity`    | `"AAP: insufficient balance"` |

**Effects (CEI: effects before interactions):**
- `_burn(msg.sender, quantity)` — caller balance −`quantity`, `totalSupply` −`quantity`.

**Interactions (after effects):**
- `(bool ok, ) = msg.sender.call{value: quantity * ticketPrice}("");`
- `require(ok, "AAP: refund failed");`

**Events:** `TicketReturned(msg.sender, quantity, quantity * ticketPrice)` emitted **before** the external call (per CEI; events log intent committed by effects, not by interaction success). Plus inherited `Transfer(msg.sender, address(0), quantity)`.

**Returns:** none.

**Notes:**
- Reentrancy: `nonReentrant` blocks the external call's recipient from re-entering `purchaseTicket`, `returnTicket`, or `withdraw`. CEI ensures that even if the guard were absent, no usable inconsistent state is observable mid-call.
- If the recipient rejects ETH (e.g., a contract with no `receive()`), the whole transaction reverts — the burn is undone by the revert, so state is preserved.

### 6.3 `verifyHolder(address wallet, uint256 minQuantity) external view returns (bool)`

Binary "doorman" check.

**Returns:** `balanceOf(wallet) >= minQuantity`.

**Reverts:** never.

**Notes:**
- `minQuantity == 0` always returns `true` (consistent with the comparison).
- Read-only; no events, no state change.

### 6.4 `withdraw() external nonReentrant`

Sends the unreserved contract balance to the venue.

**Preconditions, in evaluation order:**

| # | Check                                                                    | Revert reason             |
| - | ------------------------------------------------------------------------ | ------------------------- |
| 1 | `msg.sender == venue`                                                    | `"AAP: only venue"`       |
| 2 | `free > 0` where `free = address(this).balance − totalSupply() * ticketPrice` | `"AAP: no free balance"`  |

**Effects:** none on contract state; only ETH balance changes via the call below.

**Interactions:**
- `(bool ok, ) = venue.call{value: free}("");`
- `require(ok, "AAP: withdraw failed");`

**Events:** `Withdrawn(venue, free)` emitted before the external call.

**Returns:** none.

**Notes:**
- The reserved amount `totalSupply() * ticketPrice` is the maximum SETH the contract may need to honor return obligations. By only sending `balance − reserved`, the invariant in §1 is preserved.
- Anyone can fund the contract directly only through `purchaseTicket` (no `receive` / `fallback`), so `free` is always exactly equal to accumulated revenue from purchases minus prior withdrawals.

## 7. Events

```solidity
event TicketPurchased(address indexed buyer,  uint256 quantity, uint256 amountPaid);
event TicketReturned (address indexed holder, uint256 quantity, uint256 amountRefunded);
event Withdrawn      (address indexed venue,  uint256 amount);
```

| Event             | When                              | Field semantics                                                            |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------- |
| `TicketPurchased` | end of `purchaseTicket`'s effects | `quantity` = passes minted; `amountPaid` = wei sent (= quantity × price)   |
| `TicketReturned`  | end of `returnTicket`'s effects   | `quantity` = passes burned; `amountRefunded` = wei sent back               |
| `Withdrawn`       | inside `withdraw`, before transfer | `amount` = wei sent to venue (the free balance at call time)               |

Inherited from ERC-20:
- `Transfer(from, to, value)` — emitted by mint (`from = address(0)`), burn (`to = address(0)`), and any user transfer.
- `Approval(owner, spender, value)` — emitted by `approve` / `permit` paths.

## 8. Revert reason strings (canonical list)

Every `require` in the contract uses one of the strings below, verbatim:

| Reason                        | Where                                       |
| ----------------------------- | ------------------------------------------- |
| `"AAP: quantity zero"`        | `purchaseTicket`, `returnTicket`            |
| `"AAP: exceeds max supply"`   | `purchaseTicket`                            |
| `"AAP: incorrect payment"`    | `purchaseTicket`                            |
| `"AAP: insufficient balance"` | `returnTicket`                              |
| `"AAP: refund failed"`        | `returnTicket` (call return value)          |
| `"AAP: only venue"`           | `withdraw`                                  |
| `"AAP: no free balance"`      | `withdraw`                                  |
| `"AAP: withdraw failed"`      | `withdraw` (call return value)              |

Inherited reverts (custom errors, not reason strings):
- `ReentrancyGuardReentrantCall()` — re-entry into a `nonReentrant` function.
- `ERC20InsufficientBalance(...)`, `ERC20InvalidSender(...)`, `ERC20InvalidReceiver(...)` — from `_mint` / `_burn` / `_transfer` if their preconditions fail (e.g., transferring to zero address). In `AgentAccessPass`'s own functions, our explicit `require`s catch these cases first; inherited reverts can still surface from direct ERC-20 calls (`transfer`, `transferFrom`, `approve`).

## 9. Core invariant (load-bearing)

```
address(this).balance >= totalSupply() * ticketPrice
```

Holds at the end of every external call. Justification, by function:

- **`purchaseTicket(q)`**: balance += `q × price`; totalSupply += `q`; reserved += `q × price`. Invariant preserved.
- **`returnTicket(q)`**: totalSupply −= `q`; balance −= `q × price`; reserved −= `q × price`. Invariant preserved.
- **`withdraw()`**: balance −= `free`, where `free = balance − reserved`. Post-call balance = reserved. Invariant becomes `reserved >= reserved`, true.
- **ERC-20 `transfer` / `transferFrom`**: no change to totalSupply or contract ETH balance. Invariant unaffected.
- **Construction**: balance = 0, totalSupply = 0, reserved = 0. Invariant holds trivially.

The invariant test in T5 fuzzes random sequences of these calls and asserts the invariant after each one.

## 10. Security patterns

- **ReentrancyGuard.** `purchaseTicket`, `returnTicket`, `withdraw` all use `nonReentrant`. `verifyHolder` is `view`, no guard needed.
- **Checks-Effects-Interactions.** Every external call is preceded by all relevant state changes. `returnTicket` burns before refund. `withdraw` has no contract-state effects, so its event-emit-then-call pattern is CEI-compliant in spirit.
- **Explicit revert reason strings.** Every `require` in the contract's own functions uses a string from §8. Inherited custom errors are documented but not introduced.
- **No `receive()` / `fallback()`.** ETH cannot enter the contract except through `purchaseTicket`. This bounds the set of paths that can affect the invariant.
- **Immutable trust anchors.** `venue`, `ticketPrice`, `maxSupply` are immutable, so post-deployment compromise of the deployer key cannot redirect funds or change pricing.

## 11. Out of scope (explicitly not in this contract)

- Multiple ticket tiers (single fungible class only).
- Dynamic pricing or sale windows.
- Pausability, upgradability, ownership transfer.
- Allowlists / blocklists.
- Refund cooldowns, partial refunds, time-decayed value.
- ERC-2612 permit, ERC-1363 transferAndCall, or other non-standard extensions.
- On-chain royalties or secondary-market hooks.
- Cross-chain bridging.

If any of these become requirements, they belong in a future phase, not in this contract.

## 12. Build / Test / Deploy

```sh
forge build                         # compile
forge test -vvv                     # unit + invariant tests
forge fmt --check                   # style check (optional)

# Sepolia deploy (requires .env populated):
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Required env vars (see `.env.example`):
- `SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `TICKET_PRICE_WEI`
- `MAX_SUPPLY`
