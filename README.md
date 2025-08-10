# Minimal Proof-of-Work Blockchain (Flask)

A tiny, educational blockchain node implemented with Flask. It demonstrates the core ideas behind Bitcoin-style chains:

- **Transactions → mempool** (IOUs waiting to be sealed)
- **Mining (PoW)** → turns pending transactions into an immutable **block**
- **Hash-linked blocks** → tamper-evident **chain**
- **Peer discovery + longest-valid-chain consensus** → nodes eventually agree on the same history

It also includes a built-in **multi-node launcher** so you can spin up several nodes from one file for demos/tests.

---

## What “A → Z” Means (the full flow in one sentence)

> **A**dd transactions → **M**ine a block (solve PoW, earn reward) → **I**nspect the chain → **R**egister peers → **C**onsensus to adopt the **longest valid chain** → repeat.  
> In other words: **A**dd → **M**ine → **I**nspect → **R**egister → **C**onsensus (**A-M-I-R-C**).

---

## Features

- **Genesis block** on startup (anchor for the chain)
- **Mempool** for pending transactions
- **Proof-of-Work** (toy difficulty: 4 leading zeros)
- **Block sealing** with SHA-256 hash linking
- **Coinbase/miner reward** when a block is mined
- **Peer registration** (`/nodes/register`)
- **Consensus** (`/nodes/resolve`) via **longest valid chain**
- **Single-file multi-node supervisor**: `python blockchain.py 3` ⇒ ports 5000–5002

---

## How It Works (Concepts)

- **Transaction (IOU):** `{sender, recipient, amount}`. Added to a node’s **mempool** (not on-chain yet).
- **Mining (PoW):** Find a number `proof` so `sha256(last_proof + proof)` starts with `"0000"`.  
  If found, bundle the mempool + a **coinbase reward** into a new block, link it to the previous block’s hash, append to the chain, and clear the mempool.
- **Hash-linked blocks:** Each block stores `previous_hash = SHA256(prev_block_json)`. Changing history breaks links.
- **Consensus:** Nodes occasionally fetch peers’ `/chain`, **validate** them, and **adopt the longest valid** one. “Longest” ≈ most accumulated work.

---

## Install & Run

### 1) Environment

bash
python -m venv .venv

# Windows

. .venv/Scripts/activate

# macOS/Linux

source .venv/bin/activate

pip install flask requests 2) Start a Single Node
bash
Copy code
python blockchain.py

# serves on http://127.0.0.1:5000

3. Start Multiple Nodes (Supervisor Mode)
   bash
   Copy code

# 3 nodes on ports 5000, 5001, 5002

python blockchain.py 3
The supervisor:

Spawns N node processes on consecutive ports.

Waits until each responds.

Auto-registers all peers with each other.
Press Ctrl+C in the supervisor terminal to stop them all.

API Endpoints (and how they drive A → Z)
Base URL per node: http://127.0.0.1:<port>

POST /transactions/new → Add
Queue a new transaction (IOU) in the node’s mempool.

Example (Windows PowerShell):

powershell
Copy code
curl.exe -X POST -H "Content-Type: application/json" `  -d "{\"sender\":\"alice\",\"recipient\":\"bob\",\"amount\":5}"`
http://127.0.0.1:5000/transactions/new
Example (macOS/Linux):

bash
Copy code
curl -X POST -H "Content-Type: application/json" \
 -d '{"sender":"alice","recipient":"bob","amount":5}' \
 http://127.0.0.1:5000/transactions/new
GET /mine → Mine
Solve PoW, mint a reward, bundle pending transactions into a new block, link it, append it, and clear the mempool.

bash
Copy code
curl http://127.0.0.1:5000/mine
GET /chain → Inspect
Return the full chain and its length.

bash
Copy code
curl http://127.0.0.1:5000/chain
POST /nodes/register → Register peers
Tell a node who its peers are.
(The supervisor does this automatically.)

Example:

bash
Copy code
curl -X POST -H "Content-Type: application/json" \
 -d '{"nodes":["http://127.0.0.1:5001","http://127.0.0.1:5002"]}' \
 http://127.0.0.1:5000/nodes/register
GET /nodes/resolve → Consensus
Fetch peers’ chains, validate, and adopt the longest valid one.

bash
Copy code
curl http://127.0.0.1:5002/nodes/resolve
Example A → Z Demo
Launch 3 nodes:

bash
Copy code
python blockchain.py 3
Add transactions:

bash
Copy code
curl -X POST -H "Content-Type: application/json" \
 -d '{"sender":"alice","recipient":"bob","amount":5}' \
 http://127.0.0.1:5000/transactions/new
Mine:

bash
Copy code
curl http://127.0.0.1:5000/mine
Inspect:

bash
Copy code
curl http://127.0.0.1:5000/chain
curl http://127.0.0.1:5001/chain
curl http://127.0.0.1:5002/chain
Resolve:

bash
Copy code
curl http://127.0.0.1:5002/nodes/resolve
Elevator Pitch
“This is a Flask-based Proof-of-Work blockchain: transactions queue in a mempool, mining solves a hash-prefix puzzle to seal them into hash-linked blocks, and nodes reconcile by adopting the longest valid chain from peers. One file can run a single node or launch a multi-node network with automatic peer registration.”
