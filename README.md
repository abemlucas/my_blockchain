# 🔗 Enhanced Proof-of-Work Blockchain (Flask)

A comprehensive, educational blockchain implementation with **state management** and **transaction validation**. This project demonstrates the core concepts behind Bitcoin-style blockchains with proper account balance tracking and transaction verification.

## 🌟 Key Features

- **Genesis Block** with initial token distribution
- **State Management** with persistent account balance tracking
- **Transaction Validation** preventing overdrafts and invalid transfers
- **Proof-of-Work Mining** (configurable difficulty: 4 leading zeros)
- **Hash-linked Blocks** ensuring tamper-evident chain integrity
- **Peer Discovery** and **Longest Valid Chain Consensus**
- **Multi-node Network** launcher for testing and demonstrations
- **RESTful API** for complete blockchain interaction

---

## 🔄 The Complete Flow (A-M-I-R-C)

> **A**dd transactions → **M**ine a block (solve PoW, earn reward) → **I**nspect chain & balances → **R**egister peers → **C**onsensus to adopt longest valid chain → repeat

---

## 🏗️ How It Works

### Core Concepts

- **🔐 State Management**: Tracks account balances and validates all transactions
- **📝 Transaction Pool**: Pending transactions (IOUs) waiting to be sealed into blocks
- **⛏️ Mining (PoW)**: Find a `proof` where `sha256(last_proof + proof)` starts with `"0000"`
- **🔗 Hash-linked Blocks**: Each block references the previous block's SHA-256 hash
- **🤝 Consensus**: Nodes adopt the longest valid chain from their peers
- **💰 Mining Rewards**: Miners earn 1 token for successfully mining a block

### Transaction Validation

- ✅ Prevents overdrafts (insufficient balance)
- ✅ Validates transaction structure and amounts
- ✅ Maintains conservation of tokens (no creation/destruction)
- ✅ Special handling for mining rewards (sender = "0")

---

## 🚀 Installation & Setup

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install flask requests
```

### 2. Single Node

```bash
python blockchain.py
# Serves on http://127.0.0.1:5000
```

### 3. Multi-Node Network

```bash
# Launch 3 nodes on ports 5000-5002
python blockchain.py 3
```

The multi-node supervisor:

- 🚀 Spawns N node processes on consecutive ports
- ⏳ Waits for all nodes to become responsive
- 🔗 Auto-registers all peers with each other
- 🛑 Press `Ctrl+C` to stop all nodes gracefully

---

## 🌐 API Endpoints

Base URL: `http://127.0.0.1:<port>`

### 📝 Transaction Management

#### `POST /transactions/new` - Add Transaction

Queue a new transaction in the mempool.

**Request:**

```json
{
  "sender": "alice",
  "recipient": "bob",
  "amount": 50
}
```

**Examples:**

```bash
# Windows PowerShell
curl.exe -X POST -H "Content-Type: application/json" `
  -d "{\"sender\":\"system\",\"recipient\":\"alice\",\"amount\":50}" `
  http://127.0.0.1:5000/transactions/new

# macOS/Linux
curl -X POST -H "Content-Type: application/json" \
  -d '{"sender":"system","recipient":"alice","amount":50}' \
  http://127.0.0.1:5000/transactions/new
```

### ⛏️ Mining

#### `GET /mine` - Mine Block

Solve PoW, create new block with pending transactions, earn mining reward.

```bash
curl http://127.0.0.1:5000/mine
```

### 🔍 Chain Inspection

#### `GET /chain` - View Blockchain

Get the complete blockchain and its length.

```bash
curl http://127.0.0.1:5000/chain
```

#### `GET /state` - View All Balances

Get current state of all accounts.

```bash
curl http://127.0.0.1:5000/state
```

#### `GET /balance/<address>` - Check Balance

Get balance for a specific address.

```bash
curl http://127.0.0.1:5000/balance/alice
curl http://127.0.0.1:5000/balance/system
```

### 🤝 Network Management

#### `POST /nodes/register` - Register Peers

Tell a node about its peers (auto-done in multi-node mode).

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"nodes":["http://127.0.0.1:5001","http://127.0.0.1:5002"]}' \
  http://127.0.0.1:5000/nodes/register
```

#### `GET /nodes/resolve` - Consensus

Fetch peers' chains and adopt the longest valid one.

```bash
curl http://127.0.0.1:5002/nodes/resolve
```

---

## 🎮 Complete Demo Walkthrough

### 1. Launch Network

```bash
python blockchain.py 3
# Nodes start on ports 5000, 5001, 5002
```

### 2. Check Initial State

```bash
# Check genesis state
curl http://127.0.0.1:5000/state
curl http://127.0.0.1:5000/balance/system

# All nodes should have identical chains
curl http://127.0.0.1:5000/chain
curl http://127.0.0.1:5001/chain
curl http://127.0.0.1:5002/chain
```

### 3. Create Accounts & Transfer Tokens

```bash
# Transfer from system to alice
curl -X POST -H "Content-Type: application/json" \
  -d '{"sender":"system","recipient":"alice","amount":100}' \
  http://127.0.0.1:5000/transactions/new

# Transfer from system to bob
curl -X POST -H "Content-Type: application/json" \
  -d '{"sender":"system","recipient":"bob","amount":75}' \
  http://127.0.0.1:5000/transactions/new
```

### 4. Mine the Block

```bash
curl http://127.0.0.1:5000/mine
```

### 5. Verify Balances

```bash
curl http://127.0.0.1:5000/balance/alice   # Should be 100
curl http://127.0.0.1:5000/balance/bob     # Should be 75
curl http://127.0.0.1:5000/balance/system  # Should be 825 (1000 - 175)
curl http://127.0.0.1:5000/state          # View all balances
```

### 6. Transfer Between Users

```bash
# Alice sends to Bob
curl -X POST -H "Content-Type: application/json" \
  -d '{"sender":"alice","recipient":"bob","amount":25}' \
  http://127.0.0.1:5000/transactions/new

curl http://127.0.0.1:5000/mine
```

### 7. Test Validation (This Should Fail)

```bash
# Try overdraft - should return error
curl -X POST -H "Content-Type: application/json" \
  -d '{"sender":"alice","recipient":"bob","amount":1000}' \
  http://127.0.0.1:5000/transactions/new
```

### 8. Sync Network

```bash
# Other nodes sync with the longest chain
curl http://127.0.0.1:5001/nodes/resolve
curl http://127.0.0.1:5002/nodes/resolve

# Verify all nodes have same state
curl http://127.0.0.1:5001/balance/alice
curl http://127.0.0.1:5002/balance/bob
```

---

## 🎯 What's New in This Version

### 🔧 Core Improvements

- **✅ State Management**: Persistent account balance tracking
- **✅ Transaction Validation**: Prevents overdrafts and invalid transactions
- **✅ Genesis Block**: Proper initialization with initial token supply
- **✅ Enhanced Chain Validation**: Validates both structure AND transaction validity
- **✅ Error Handling**: Comprehensive error handling for network and validation issues
- **✅ State Reconstruction**: Rebuilds state after chain replacement during consensus

### 🆕 New API Endpoints

- `GET /balance/<address>` - Check individual account balance
- `GET /state` - View complete blockchain state

### 🛡️ Security Enhancements

- Transaction validation before adding to mempool
- Proper state consistency during consensus resolution
- Enhanced chain validation with transaction verification
- Robust error handling for network operations

---

## 🎓 Educational Value

This implementation demonstrates:

- **Blockchain Fundamentals**: Hash linking, consensus, immutability
- **Cryptocurrency Mechanics**: Account balances, transaction validation, mining rewards
- **Distributed Systems**: Peer-to-peer networking, eventual consistency
- **Proof-of-Work**: Computational puzzles for block creation
- **State Management**: How blockchains track and validate state changes

---

## 🚨 Important Notes

- **Educational Purpose**: This is a learning tool, not production-ready
- **Simplified Security**: Real blockchains use digital signatures and more complex validation
- **Network Assumptions**: Assumes honest majority and reliable network communication
- **Scalability**: Not optimized for large-scale deployment

---

## 🏁 Quick Start Summary

```bash
# 1. Install
pip install flask requests

# 2. Run multi-node network
python blockchain.py 3

# 3. Try the demo commands above!
```

**🎉 Elevator Pitch**: "A Flask-based educational blockchain with complete state management: transactions are validated against account balances, mining seals them into hash-linked blocks, and nodes achieve consensus by adopting the longest valid chain. Perfect for understanding how cryptocurrencies actually work under the hood!"
