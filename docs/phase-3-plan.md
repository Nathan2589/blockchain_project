# Phase 3 — Programmatic Agent Demonstration

Strict-scope plan, mirroring the discipline of Phase 1 and 2. Every line of work is in one of the tasks below; everything else is explicitly **not** Phase 3.

## Goal

Demonstrate that the access-pass mechanism works for non-human actors: a **service-consuming agent** purchases a pass on chain, presents cryptographic proof of ownership, and is granted access by an independent **service-providing agent** (verifier). The two agents talk over HTTP; on-chain verification uses the live Sepolia contract at `0x2FA94Dd1d27D2EF8CB906297E4280BEe0478ca1F`.

The decision step inside the buyer agent is factored behind a `Decider` interface so a future LLM-driven version can be dropped in without rearchitecting.

## Locked decisions (from kickoff)

| Choice                | Resolution                                                                |
| --------------------- | ------------------------------------------------------------------------- |
| Language              | Python 3.11+                                                              |
| HTTP / web framework  | FastAPI (uvicorn)                                                         |
| Chain client          | web3.py + eth-account                                                     |
| HTTP client (buyer)   | httpx                                                                     |
| Architecture          | Two processes — `buyer_agent.py` CLI + `service.py` HTTP server           |
| Network               | Real Sepolia (live contract)                                              |
| Agent intelligence    | Procedural now, `Decider` Protocol leaves an LLM driver as a future swap   |
| Auth scheme           | EIP-191 personal_sign challenge → recover → on-chain `verifyHolder`       |
| Repo location         | `ticketing_dapp/agent-demo/` subdirectory                                 |
| Package management    | `pyproject.toml`; `uv` if installed, falling back to `pip` + venv         |
| ABI / address source  | Synced from `out/` and `deployments/sepolia.json` via `scripts/sync_abi.py`|

## Final layout

```
ticketing_dapp/
├── agent-demo/
│   ├── pyproject.toml
│   ├── README.md
│   ├── .env.example
│   ├── .env.local                       (gitignored)
│   ├── .gitignore
│   ├── scripts/
│   │   └── sync_abi.py                  (Python twin of the frontend script)
│   ├── abi/
│   │   ├── AgentAccessPass.json         (generated)
│   │   └── deployment.json              (generated)
│   └── src/aap_demo/
│       ├── __init__.py
│       ├── chain.py                     (web3 client + contract handle)
│       ├── crypto.py                    (sign / recover / nonce store)
│       ├── decider.py                   (Decider Protocol + ProceduralDecider)
│       ├── service.py                   (FastAPI app: /challenge, /access)
│       └── buyer_agent.py               (CLI: orchestrates the demo flow)
```

`abi/` and `src/aap_demo/abi/` are NOT duplicated; the service and the agent both read from `abi/` at the package root.

## Auth flow (concrete)

```
buyer_agent                                  service (:3000)
─────────────────────────────────────────────────────────────────────────
GET  /challenge ───────────────────────────►
                                             new_nonce() → store {nonce: issued_at}
                                             return {nonce, expires_at}
◄────────────── {nonce, expires_at}

# build EIP-191 message
msg = f"AAP-DEMO\naddress: {addr}\nnonce: {nonce}"
sig = account.sign_message(encode_defunct(text=msg))

POST /access {address, message, signature} ─►
                                             recovered = recover_message(message, sig)
                                             assert recovered == address
                                             assert nonce parsed from message
                                             assert nonce unused, not expired
                                             ok = pass.verifyHolder(address, 1)
                                             if ok:    consume_nonce; return 200 + payload
                                             else:     return 403 + reason
◄─────────── 200 + service payload
            (or 403 + revert reason)
```

Nonces live in an in-memory dict on the service for the demo. Single-use, 60-second TTL, removed on use. No DB.

## Tasks

### T1 — Project init
- Create `agent-demo/` and a `pyproject.toml` with explicit deps: `web3>=7`, `eth-account`, `fastapi`, `uvicorn[standard]`, `httpx`, `python-dotenv`, `pydantic`.
- Add `.python-version` (3.11+).
- `scripts/sync_abi.py` — reads `../out/AgentAccessPass.sol/AgentAccessPass.json` and `../deployments/sepolia.json`, writes `abi/AgentAccessPass.json` (just the abi array) and `abi/deployment.json` (chainId, address, deploymentBlock, sourceCommit). Mirror of the frontend's sync script.
- `.env.example` documents `SEPOLIA_RPC_URL`, `BUYER_PRIVATE_KEY`, `SERVICE_PORT` (default 3000).
- `.gitignore` covers `__pycache__/`, `.venv/`, `*.egg-info/`, `.env`, `.env.*`, `!.env.example`, `abi/AgentAccessPass.json`, `abi/deployment.json` (actually I'd rather track the synced files for reproducibility — final call inside this task).
- **Exit:** `python -c "import aap_demo"` (or `uv run python -c "import aap_demo"`) imports the package; `python scripts/sync_abi.py` populates `abi/`.

### T2 — `chain.py`
- Build a `Web3` instance from `SEPOLIA_RPC_URL` with the standard HTTPProvider; assert `chain_id == 11155111` at startup.
- Load contract from `abi/AgentAccessPass.json` and `abi/deployment.json`.
- Helper `get_account(private_key) -> LocalAccount` from eth-account.
- Helpers: `read_total_supply()`, `read_balance_of(addr)`, `verify_holder(addr, min_qty)`, `purchase_ticket(account, qty)`, `return_ticket(account, qty)` — last two return `(tx_hash, receipt)` after waiting for confirmation.
- **Exit:** Manual smoke: `python -c "from aap_demo.chain import *; print(read_total_supply())"` returns the on-chain value.

### T3 — `crypto.py`
- `sign_access_message(account, address, nonce) -> hex_signature` — composes the canonical message string and EIP-191 signs it.
- `recover_access_signer(message, signature) -> address`.
- `NonceStore` class: `issue() -> nonce`, `consume(nonce) -> bool` (returns False if missing, used, or expired).
- TTL constant (60s) at the top of the module.
- **Exit:** Round-trip unit test in a single `if __name__ == "__main__":` block: sign → recover → equals.

### T4 — `decider.py`
- `class AgentState` (Pydantic BaseModel): `address`, `seth_balance_wei`, `pass_balance`, `accessed_service`, `loop_count`.
- `class Action(Enum)`: `CHECK_BALANCE`, `PURCHASE`, `REQUEST_SERVICE`, `RETURN_TICKET`, `DONE`.
- `class Decider(Protocol)`: single method `next_action(state) -> Action`.
- `class ProceduralDecider`: hard-coded sequence — purchase if no pass, request service if not yet accessed, return ticket once accessed, then DONE.
- **Exit:** Test via a small driver in `if __name__ == "__main__"` that walks the state through the four actions.

### T5 — `service.py` (FastAPI app)
- `/challenge` (GET): returns `{nonce, expires_at}` from the in-memory store.
- `/access` (POST): body `{address, message, signature}`; runs the recover → nonce-consume → `verify_holder` chain; returns `{granted: true, payload: ...}` or HTTP 403 with `{granted: false, reason: ...}`.
- `/health` (GET): returns `{ok: true, chain_id, contract}`.
- Run with `uvicorn aap_demo.service:app --port $SERVICE_PORT`.
- **Exit:** `curl localhost:3000/health` returns 200 with the live chain id and contract address.

### T6 — `buyer_agent.py` (CLI)
- Argparse: `--service-url` (default `http://localhost:3000`), `--quantity` (default 1), `--no-return` (flag to skip the `returnTicket` step).
- Initializes the buyer account from `BUYER_PRIVATE_KEY`, builds the contract handle.
- Loop: read state → ask `Decider.next_action(state)` → execute → log → repeat until `Action.DONE`.
- Logs each step with a timestamp and on-chain tx hash (when applicable). Use stdlib `logging` with a single configured handler (no third-party logger dep).
- **Exit:** Running `python -m aap_demo.buyer_agent` against a live service walks through PURCHASE → REQUEST_SERVICE → RETURN_TICKET → DONE, prints clean numbered steps with tx hashes and Etherscan links.

### T7 — End-to-end demo verification
- Run `service.py` in one terminal; `buyer_agent.py` in another; confirm the full flow completes against the live contract.
- Capture the buyer-agent stdout into `agent-demo/.demo/run-{timestamp}.log` so you have a recorded artifact.
- Confirm the service emits clear request logs.
- Confirm the buyer agent terminates cleanly with a non-zero exit code on any auth or chain failure.
- **Exit:** A captured log shows the complete sequence: balance check → purchase tx confirmed → challenge → POST /access → 200 → returnTicket tx confirmed → DONE.

### T8 — Phase complete
- `README.md` for `agent-demo/` covering: prerequisites, `cp .env.example .env.local`, `uv sync` (or `pip install -e .`), how to run service + agent, expected output, and the seam where an LLM driver would slot into `decider.py`.
- Update `CLAUDE.md` status to mark Phase 3 complete.
- Atomic commits per task.

## Non-goals (explicitly out of Phase 3)

- LLM-driven decision making. The `Decider` Protocol leaves the seam; nothing else.
- Multiple concurrent buyer agents. Single-agent demo only.
- Persistent service state (DB, file-backed nonce store, etc.). In-memory dict, single process.
- Production deployment of the service (no Docker, no Vercel, no systemd unit).
- WalletConnect, MetaMask, or any browser wallet integration — buyer signs locally with its own private key.
- Replay protection beyond single-use nonce + 60s TTL. No on-chain anti-replay, no signed timestamps, no domain separators (EIP-712).
- Extended service capability — `/access` returns a static "granted" payload. No real downstream API call, no LLM completion, no rate limit.
- Anvil-fork mode. Only real Sepolia.
- Integration with the frontend. The frontend stays browser-only; the agent demo stays terminal-only. No shared state between them.
- Bundle size optimization, async parallelism for chain reads, retries on RPC errors. Demo scope, not prod.

## Risks / what to watch

- **Sepolia tx latency.** Each on-chain step is ~15–30s. The buyer agent must wait on `eth_getTransactionReceipt` polling; web3.py's `wait_for_transaction_receipt(timeout=120)` is the right primitive. Surface a clear "waiting for confirmation…" line so the demo doesn't look hung.
- **Nonce fees / nonce drift.** If a previous tx is stuck in mempool, `purchase_ticket` will fail with a nonce conflict. Add `nonce=w3.eth.get_transaction_count(addr)` explicitly when building tx; surface a useful error if the buyer wallet has stale pending txs.
- **EIP-191 vs EIP-712 confusion.** We're using EIP-191 personal_sign for simplicity. Document this in the README — anyone integrating later should know it's not domain-separated. EIP-712 is a follow-up if needed.
- **Funding requirement.** The demo only works if `BUYER_PRIVATE_KEY` controls a Sepolia-funded address with at least `quantity * ticketPrice + ~0.001 SETH` for gas. README must explain this and link a faucet.
- **Service exposure.** `service.py` runs on `localhost` only. Don't accidentally bind 0.0.0.0; uvicorn defaults to 127.0.0.1, but be explicit.
- **Revert decoding.** web3.py raises `ContractLogicError` with the message including the require string. The buyer-agent error path should pull `AAP: …` reasons and surface them, similar to the frontend's `decodeRevertReason`.

## What I need before starting execution

Your ratification of this plan as-is, or amendments. Once ratified I'll work T1 → T8 in order, atomic commit per task.

A practical prerequisite for T7's end-to-end verification: a Sepolia-funded buyer wallet (separate from the deployer / venue). If you don't already have one, the wallet generated by `/create` in Phase 2 + a Sepolia faucet top-up is the obvious source.
