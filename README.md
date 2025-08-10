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

-Starting a Single Node:
**python blockchain.py
-Starting X Nodes:
**python blockchain.py X
