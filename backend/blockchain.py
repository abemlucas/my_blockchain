import hashlib
import json
from textwrap import dedent
from time import time
from uuid import uuid4
from flask import Flask, jsonify, request
from urllib.parse import urlparse
import requests
from flask_cors import CORS
from wallet import Wallet, SecureTransaction, create_wallet
from enhanced_block import EnhancedBlock, DifficultyAdjustment
from transactions import (
    MultiSigTransaction, 
    TimeLockTransaction, 
    SmartContract, 
    ContractDeployTransaction, 
    ContractCallTransaction
)

class Blockchain(object):
    def __init__(self):
        self.chain = []
        self.current_transactions = []
        self.nodes = set()
        # Initialize with genesis block and proper state tracking
        self.state = {}
        self.wallets = {}  # Store wallets for this node
        self.contracts = {}  # Store deployed smart contracts
        self.difficulty_adjuster = DifficultyAdjustment(target_block_time=10, adjustment_interval=5)
        self.current_difficulty = 4  # Starting difficulty
        self.transaction_fee = 0.001  # Basic transaction fee
        self._create_genesis_block()
    
    def _create_genesis_block(self):
        """Create the genesis block with initial state using a real wallet"""
        # Create genesis wallet
        genesis_wallet = create_wallet()
        genesis_address = genesis_wallet.address
        
        # Store genesis wallet
        self.wallets['genesis'] = genesis_wallet
        
        # Initialize accounts for demonstration
        genesis_state = {genesis_address: 1000000}  # Genesis wallet starts with 1M coins
        self.state = genesis_state.copy()
        
        # Create genesis transaction
        genesis_tx = {
            'sender': '0',  # Special genesis sender
            'recipient': genesis_address,
            'amount': 1000000,
            'timestamp': time(),
            'type': 'genesis'
        }
        
        # Create genesis block using EnhancedBlock
        genesis_block = EnhancedBlock(
            index=0,
            transactions=[genesis_tx],
            proof=100,
            previous_hash='0',  # Genesis has no previous block
            miner_address='genesis',
            difficulty=self.current_difficulty
        )
        
        self.chain.append(genesis_block)
        return genesis_block

    def new_block(self, proof, previous_hash=None, miner_address=None):
        """
        Create a new Enhanced Block in the Blockchain
        """
        # Adjust difficulty if needed
        if len(self.chain) % self.difficulty_adjuster.adjustment_interval == 0:
            self.current_difficulty = self.difficulty_adjuster.adjust_difficulty(self)
        
        # Create new enhanced block
        new_block = EnhancedBlock(
            index=len(self.chain),
            transactions=self.current_transactions.copy(),
            proof=proof,
            previous_hash=previous_hash or self.chain[-1].hash,
            miner_address=miner_address or 'unknown',
            difficulty=self.current_difficulty
        )
        
        # Validate the block before adding
        if self._validate_new_block(new_block):
            # Apply transactions to state
            for tx in new_block.transactions:
                self._update_state_with_transaction(tx)
            
            # Add block to chain
            self.chain.append(new_block)
            
            # Clear processed transactions
            self.current_transactions = []
            
            return new_block
        else:
            raise ValueError("Invalid block created")

    def _validate_new_block(self, block):
        """Validate a new block before adding to chain"""
        try:
            # Check index
            if block.index != len(self.chain):
                print(f"Invalid index: expected {len(self.chain)}, got {block.index}")
                return False
            
            # Check previous hash
            if len(self.chain) > 0 and block.previous_hash != self.chain[-1].hash:
                print(f"Invalid previous hash: expected {self.chain[-1].hash}, got {block.previous_hash}")
                return False
            
            # Validate proof of work
            if not self.valid_proof(block.previous_hash, block.proof, block.difficulty):
                print(f"Invalid proof of work: {block.proof}")
                return False
            
            # Validate Merkle root
            calculated_merkle = block.calculate_merkle_root()
            if calculated_merkle != block.merkle_root:
                print(f"Invalid Merkle root: expected {calculated_merkle}, got {block.merkle_root}")
                return False
            
            # Validate all transactions
            temp_state = self.state.copy()
            temp_contracts = self.contracts.copy()
            
            for tx in block.transactions:
                if not self._is_valid_transaction_for_state(tx, temp_state, temp_contracts):
                    print(f"Invalid transaction: {tx}")
                    return False
                self._apply_transaction_to_temp_state(tx, temp_state, temp_contracts)
            
            return True
        except Exception as e:
            print(f"Error validating block: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _is_valid_transaction_for_state(self, transaction, state, contracts=None):
        """Check if transaction is valid for given state"""
        try:
            # Handle different transaction types
            if hasattr(transaction, 'transaction_type'):
                return self._validate_advanced_transaction(transaction, state, contracts or {})
            elif hasattr(transaction, 'sender'):
                # Regular SecureTransaction
                sender = transaction.sender
                amount = transaction.amount
                # Verify signature for SecureTransaction (skip for mining rewards)
                if sender != "0" and not transaction.verify_transaction():
                    print(f"Invalid signature for transaction from {sender}")
                    return False
            else:
                # Dictionary transaction (legacy/genesis)
                sender = transaction['sender']
                amount = transaction['amount']
            
            # Mining rewards are always valid
            if sender == "0":
                return True
            
            # Check balance for regular transactions
            if sender not in state:
                print(f"Sender {sender} not found in state")
                return False
                
            if state[sender] < amount:
                print(f"Insufficient balance: {sender} has {state[sender]}, needs {amount}")
                return False
                
            if amount <= 0:
                print(f"Invalid amount: {amount}")
                return False
            
            return True
        except Exception as e:
            print(f"Error validating transaction: {e}")
            return False

    def _validate_advanced_transaction(self, transaction, state, contracts):
        """Validate advanced transaction types"""
        tx_type = transaction.transaction_type
        
        if tx_type == "multisig":
            # Validate multi-sig transaction
            if not transaction.verify_transaction():
                return False
            
            # Check if all senders have enough balance combined
            total_balance = sum(state.get(addr, 0) for addr in transaction.sender_addresses)
            return total_balance >= transaction.amount
        
        elif tx_type == "timelock":
            # Validate time-lock transaction
            return transaction.verify_transaction() and transaction.is_unlocked()
        
        elif tx_type == "contract_deploy":
            # Validate contract deployment
            if not transaction.verify_transaction():
                return False
            
            # Check if creator has enough balance for deployment + initial value
            creator_balance = state.get(transaction.creator_address, 0)
            total_cost = transaction.initial_value + self.transaction_fee
            return creator_balance >= total_cost
        
        elif tx_type == "contract_call":
            # Validate contract call
            if not transaction.verify_transaction():
                return False
            
            # Check if contract exists
            if transaction.contract_address not in contracts:
                return False
            
            # Check if caller has enough balance
            caller_balance = state.get(transaction.caller_address, 0)
            total_cost = transaction.value + self.transaction_fee
            return caller_balance >= total_cost
        
        return False

    def _apply_transaction_to_temp_state(self, transaction, state, contracts=None):
        """Apply transaction to temporary state"""
        if hasattr(transaction, 'transaction_type'):
            self._apply_advanced_transaction(transaction, state, contracts or {})
        else:
            # Apply regular transaction
            if hasattr(transaction, 'sender'):
                sender = transaction.sender
                recipient = transaction.recipient
                amount = transaction.amount
            else:
                sender = transaction['sender']
                recipient = transaction['recipient']
                amount = transaction['amount']
            
            if sender == "0":  # Mining reward
                if recipient not in state:
                    state[recipient] = 0
                state[recipient] += amount
            else:
                state[sender] -= amount
                if recipient not in state:
                    state[recipient] = 0
                state[recipient] += amount

    def _apply_advanced_transaction(self, transaction, state, contracts):
        """Apply advanced transaction to state"""
        tx_type = transaction.transaction_type
        
        if tx_type == "multisig":
            # Deduct from all sender addresses proportionally
            amount_per_sender = transaction.amount / len(transaction.sender_addresses)
            for addr in transaction.sender_addresses:
                state[addr] -= amount_per_sender
            
            # Add to recipient
            if transaction.recipient not in state:
                state[transaction.recipient] = 0
            state[transaction.recipient] += transaction.amount
        
        elif tx_type == "timelock":
            # Apply like regular transaction (validation already checked unlock)
            state[transaction.sender] -= transaction.amount
            if transaction.recipient not in state:
                state[transaction.recipient] = 0
            state[transaction.recipient] += transaction.amount
        
        elif tx_type == "contract_deploy":
            # Deploy contract
            contracts[transaction.contract.contract_address] = transaction.contract
            
            # Deduct deployment cost
            state[transaction.creator_address] -= self.transaction_fee
            
            # Transfer initial value to contract
            if transaction.initial_value > 0:
                state[transaction.creator_address] -= transaction.initial_value
                transaction.contract.balance = transaction.initial_value
        
        elif tx_type == "contract_call":
            # Execute contract function
            contract = contracts[transaction.contract_address]
            result = contract.execute(
                transaction.function_name,
                transaction.parameters,
                transaction.caller_address,
                transaction.value
            )
            
            # Deduct call cost and value from caller
            state[transaction.caller_address] -= (transaction.value + self.transaction_fee)
            
            # Handle transfers from contract execution
            if result.get("success") and "transfer" in result:
                transfer = result["transfer"]
                recipient = transfer["to"]
                amount = transfer["amount"]
                
                if recipient not in state:
                    state[recipient] = 0
                state[recipient] += amount

    def _update_state_with_transaction(self, transaction):
        """Update blockchain state with a transaction"""
        if hasattr(transaction, 'transaction_type'):
            self._apply_advanced_transaction(transaction, self.state, self.contracts)
        else:
            # Handle regular transactions
            if hasattr(transaction, 'sender'):
                sender = transaction.sender
                recipient = transaction.recipient
                amount = transaction.amount
            else:
                sender = transaction['sender']
                recipient = transaction['recipient']
                amount = transaction['amount']
            
            # Handle mining rewards
            if sender == "0":
                if recipient not in self.state:
                    self.state[recipient] = 0
                self.state[recipient] += amount
            else:
                # Regular transaction
                self.state[sender] -= amount
                if recipient not in self.state:
                    self.state[recipient] = 0
                self.state[recipient] += amount

    def new_transaction(self, transaction_obj):
        """
        Add a new transaction object to the blockchain
        """
        # Validate transaction
        if not self._is_valid_transaction_for_state(transaction_obj, self.state, self.contracts):
            raise ValueError("Invalid transaction")
        
        self.current_transactions.append(transaction_obj)
        return len(self.chain)

    def get_balance(self, address):
        """Get the current balance of an address"""
        return self.state.get(address, 0)

    def get_contract(self, contract_address):
        """Get a smart contract by address"""
        return self.contracts.get(contract_address)

    @property
    def last_block(self):
        return self.chain[-1]

    @staticmethod
    def hash(block):
        """
        Creates a SHA-256 hash of a Block (for backward compatibility)
        """
        if hasattr(block, 'hash'):
            return block.hash
        else:
            block_string = json.dumps(block, sort_keys=True).encode()
            return hashlib.sha256(block_string).hexdigest()

    def proof_of_work(self, last_hash, difficulty=None):
        """
        Enhanced Proof of Work with configurable difficulty
        """
        if difficulty is None:
            difficulty = self.current_difficulty
            
        proof = 0
        while self.valid_proof(last_hash, proof, difficulty) is False:
            proof += 1
        return proof

    @staticmethod
    def valid_proof(last_hash, proof, difficulty=4):
        """
        Validates the Proof with configurable difficulty
        """
        guess = f'{last_hash}{proof}'.encode()
        guess_hash = hashlib.sha256(guess).hexdigest()
        return guess_hash[:difficulty] == "0" * difficulty

    def register_node(self, address):
        """Add a new node to the list of nodes"""
        parsed_url = urlparse(address)
        if parsed_url.netloc:
            self.nodes.add(parsed_url.netloc)
        elif parsed_url.path:
            self.nodes.add(parsed_url.path)
        else:
            raise ValueError('Invalid URL')

    def valid_chain(self, chain_data):
        """Enhanced chain validation with advanced transactions"""
        if not chain_data:
            return False
            
        # Check genesis block
        if len(chain_data) == 0:
            return False
        
        # Convert chain data to EnhancedBlock objects for validation
        try:
            chain = []
            for block_data in chain_data:
                if isinstance(block_data, dict):
                    block = EnhancedBlock.from_dict(block_data)
                else:
                    block = block_data
                chain.append(block)
        except Exception as e:
            print(f"Error converting chain: {e}")
            return False
        
        # Validate genesis block
        genesis_block = chain[0]
        if genesis_block.previous_hash != '0':
            return False
        
        # Validate each subsequent block
        temp_state = {}
        temp_contracts = {}
        
        # Initialize state from genesis
        for tx in genesis_block.transactions:
            if isinstance(tx, dict) and 'type' in tx and tx['type'] == 'genesis':
                temp_state[tx['recipient']] = tx['amount']
        
        # Validate rest of chain
        for i in range(1, len(chain)):
            current_block = chain[i]
            previous_block = chain[i-1]
            
            # Check index
            if current_block.index != i:
                return False
            
            # Check previous hash
            if current_block.previous_hash != previous_block.hash:
                return False
            
            # Check proof of work
            if not self.valid_proof(current_block.previous_hash, current_block.proof, current_block.difficulty):
                return False
            
            # Validate Merkle root
            if current_block.merkle_root != current_block.calculate_merkle_root():
                return False
            
            # Validate transactions
            for tx in current_block.transactions:
                if not self._is_valid_transaction_for_state(tx, temp_state, temp_contracts):
                    return False
                self._apply_transaction_to_temp_state(tx, temp_state, temp_contracts)
        
        return True

    def resolve_conflicts(self):
        """Enhanced consensus algorithm with advanced transaction support"""
        neighbours = self.nodes
        new_chain = None
        max_length = len(self.chain)

        for node in neighbours:
            try:
                response = requests.get(f'http://{node}/chain', timeout=5)
                
                if response.status_code == 200:
                    data = response.json()
                    length = data['length']
                    chain_data = data['chain']

                    # Check if the length is longer and the chain is valid
                    if length > max_length and self.valid_chain(chain_data):
                        max_length = length
                        new_chain = chain_data
            except requests.RequestException as e:
                print(f"Error connecting to node {node}: {e}")
                continue

        # Replace our chain if we discovered a new, valid chain longer than ours
        if new_chain:
            # Convert to EnhancedBlock objects
            self.chain = []
            for block_data in new_chain:
                self.chain.append(EnhancedBlock.from_dict(block_data))
            
            self._rebuild_state()
            return True

        return False
    
    def _rebuild_state(self):
        """Rebuild state and contracts from the current chain"""
        self.state = {}
        self.contracts = {}
        
        for block in self.chain:
            for tx in block.transactions:
                if isinstance(tx, dict) and 'type' in tx and tx['type'] == 'genesis':
                    # Genesis transaction
                    self.state[tx['recipient']] = tx['amount']
                else:
                    # Regular or advanced transaction
                    self._update_state_with_transaction(tx)

    # Wallet management methods (unchanged)
    def create_wallet(self, wallet_id=None):
        """Create a new wallet for this node"""
        if wallet_id is None:
            wallet_id = str(uuid4())[:8]
        
        wallet = create_wallet()
        self.wallets[wallet_id] = wallet
        return wallet_id, wallet

    def get_wallet(self, wallet_id):
        """Get a wallet by ID"""
        return self.wallets.get(wallet_id)

app = Flask(__name__)
CORS(app)
node_identifier = str(uuid4()).replace('-', '')

# Instantiate the Blockchain
blockchain = Blockchain()

# Wallet endpoints (unchanged)
@app.route('/wallet/create', methods=['POST'])
def create_wallet_endpoint():
    """Create a new wallet"""
    try:
        wallet_id, wallet = blockchain.create_wallet()
        
        response = {
            'wallet_id': wallet_id,
            'address': wallet.address,
            'public_key': wallet.get_public_key_pem(),
            'balance': blockchain.get_balance(wallet.address),
            'message': 'Wallet created successfully'
        }
        
        return jsonify(response), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/wallets', methods=['GET'])
def list_wallets():
    """List all wallets on this node"""
    wallets_info = []
    for wallet_id, wallet in blockchain.wallets.items():
        wallets_info.append({
            'wallet_id': wallet_id,
            'address': wallet.address,
            'balance': blockchain.get_balance(wallet.address)
        })
    
    return jsonify({
        'wallets': wallets_info,
        'total_wallets': len(wallets_info)
    }), 200

# Advanced transaction endpoints
@app.route('/transactions/multisig', methods=['POST'])
def create_multisig_transaction():
    """Create a multi-signature transaction"""
    try:
        values = request.get_json()
        required = ['sender_addresses', 'recipient', 'amount']
        
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Create multi-sig transaction
        multisig_tx = MultiSigTransaction(
            values['sender_addresses'],
            values['recipient'],
            values['amount'],
            values.get('required_signatures')
        )
        
        response = {
            'transaction_id': multisig_tx.transaction_id,
            'message': 'Multi-sig transaction created. Collect signatures before submitting.',
            'transaction': multisig_tx.to_dict()
        }
        
        return jsonify(response), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/transactions/timelock', methods=['POST'])
def create_timelock_transaction():
    """Create a time-locked transaction"""
    try:
        values = request.get_json()
        required = ['wallet_id', 'recipient', 'amount', 'unlock_time']
        
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing required fields'}), 400
        
        wallet = blockchain.get_wallet(values['wallet_id'])
        if not wallet:
            return jsonify({'error': 'Wallet not found'}), 404
        
        # Create time-lock transaction
        timelock_tx = TimeLockTransaction(
            wallet.address,
            values['recipient'],
            values['amount'],
            values['unlock_time'],
            wallet
        )
        
        # Add to blockchain if unlocked, otherwise return for later submission
        if timelock_tx.is_unlocked():
            index = blockchain.new_transaction(timelock_tx)
            message = f'Time-lock transaction added to Block {index}'
        else:
            message = 'Time-lock transaction created but not yet unlocked'
        
        response = {
            'transaction_id': timelock_tx.transaction_id,
            'message': message,
            'unlocked': timelock_tx.is_unlocked(),
            'unlock_time': timelock_tx.unlock_time,
            'transaction': timelock_tx.to_dict()
        }
        
        return jsonify(response), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/contracts/deploy', methods=['POST'])
def deploy_contract():
    """Deploy a smart contract"""
    try:
        values = request.get_json()
        required = ['wallet_id', 'contract_code']
        
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing required fields'}), 400
        
        wallet = blockchain.get_wallet(values['wallet_id'])
        if not wallet:
            return jsonify({'error': 'Wallet not found'}), 404
        
        # Create contract deployment transaction
        deploy_tx = ContractDeployTransaction(
            wallet.address,
            values['contract_code'],
            values.get('initial_value', 0),
            wallet
        )
        
        # Add to blockchain
        index = blockchain.new_transaction(deploy_tx)
        
        response = {
            'message': f'Contract deployment added to Block {index}',
            'contract_address': deploy_tx.contract.contract_address,
            'transaction_id': deploy_tx.transaction_id,
            'transaction': deploy_tx.to_dict()
        }
        
        return jsonify(response), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/contracts/call', methods=['POST'])
def call_contract():
    """Call a smart contract function"""
    try:
        values = request.get_json()
        required = ['wallet_id', 'contract_address', 'function_name']
        
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing required fields'}), 400
        
        wallet = blockchain.get_wallet(values['wallet_id'])
        if not wallet:
            return jsonify({'error': 'Wallet not found'}), 404
        
        # Create contract call transaction
        call_tx = ContractCallTransaction(
            wallet.address,
            values['contract_address'],
            values['function_name'],
            values.get('parameters', {}),
            values.get('value', 0),
            wallet
        )
        
        # Add to blockchain
        index = blockchain.new_transaction(call_tx)
        
        response = {
            'message': f'Contract call added to Block {index}',
            'transaction_id': call_tx.transaction_id,
            'transaction': call_tx.to_dict()
        }
        
        return jsonify(response), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/contracts', methods=['GET'])
def list_contracts():
    """List all deployed contracts"""
    contracts_info = []
    for address, contract in blockchain.contracts.items():
        contracts_info.append({
            'contract_address': address,
            'creator_address': contract.creator_address,
            'balance': contract.balance,
            'state': contract.state,
            'created_at': contract.created_at
        })
    
    return jsonify({
        'contracts': contracts_info,
        'total_contracts': len(contracts_info)
    }), 200

@app.route('/contracts/<contract_address>', methods=['GET'])
def get_contract(contract_address):
    """Get contract details"""
    contract = blockchain.get_contract(contract_address)
    if not contract:
        return jsonify({'error': 'Contract not found'}), 404
    
    return jsonify(contract.to_dict()), 200

@app.route('/mine', methods=['GET'])
def mine():
    try:
        # We run the proof of work algorithm to get the next proof
        last_block = blockchain.last_block
        last_hash = last_block.hash
        proof = blockchain.proof_of_work(last_hash, blockchain.current_difficulty)

        # Mining reward
        mining_reward = SecureTransaction("0", node_identifier, 1)
        blockchain.new_transaction(mining_reward)

        # Forge the new Block
        block = blockchain.new_block(proof, last_hash, node_identifier)

        response = {
            'message': "New Block Forged",
            'index': block.index,
            'transactions': [tx.to_dict() if hasattr(tx, 'to_dict') else tx for tx in block.transactions],
            'proof': block.proof,
            'previous_hash': block.previous_hash,
            'merkle_root': block.merkle_root,
            'difficulty': block.difficulty,
            'hash': block.hash
        }
        return jsonify(response), 200
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Mining error: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 500

@app.route('/transactions/new', methods=['POST'])
def new_transaction():
    """Create a regular transaction (legacy endpoint)"""
    values = request.get_json()

    # Check for signed transaction format
    if 'signature' in values and 'sender_public_key' in values:
        # This is a signed transaction
        required = ['sender', 'recipient', 'amount', 'signature', 'sender_public_key']
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing values for signed transaction'}), 400

        try:
            # Create SecureTransaction object
            tx = SecureTransaction(values['sender'], values['recipient'], values['amount'])
            tx.signature = values['signature']
            tx.sender_public_key = values['sender_public_key']
            
            index = blockchain.new_transaction(tx)
            response = {'message': f'Signed transaction will be added to Block {index}'}
            return jsonify(response), 201
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
    else:
        # Legacy unsigned transaction (for backward compatibility)
        required = ['sender', 'recipient', 'amount']
        if not all(k in values for k in required):
            return jsonify({'error': 'Missing values'}), 400

        try:
            tx = SecureTransaction(values['sender'], values['recipient'], values['amount'])
            index = blockchain.new_transaction(tx)
            response = {'message': f'Transaction will be added to Block {index}'}
            return jsonify(response), 201
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

@app.route('/transactions/sign', methods=['POST'])
def sign_transaction():
    """Sign a transaction with a wallet"""
    values = request.get_json()
    
    required = ['wallet_id', 'recipient', 'amount']
    if not all(k in values for k in required):
        return jsonify({'error': 'Missing values'}), 400
    
    wallet = blockchain.get_wallet(values['wallet_id'])
    if not wallet:
        return jsonify({'error': 'Wallet not found'}), 404
    
    try:
        # Create and sign transaction
        tx = SecureTransaction(
            wallet.address, 
            values['recipient'], 
            values['amount'], 
            wallet
        )
        
        # Add to blockchain
        index = blockchain.new_transaction(tx)
        
        response = {
            'message': f'Signed transaction will be added to Block {index}',
            'transaction': tx.to_dict()
        }
        return jsonify(response), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/chain', methods=['GET'])
def full_chain():
    # Convert EnhancedBlock objects to dicts for JSON serialization
    chain_data = [block.to_dict() for block in blockchain.chain]
    
    response = {
        'chain': chain_data,
        'length': len(blockchain.chain),
        'current_difficulty': blockchain.current_difficulty
    }
    return jsonify(response), 200

@app.route('/balance/<address>', methods=['GET'])
def get_balance(address):
    balance = blockchain.get_balance(address)
    response = {'address': address, 'balance': balance}
    return jsonify(response), 200

@app.route('/state', methods=['GET'])
def get_state():
    response = {'state': blockchain.state}
    return jsonify(response), 200

@app.route('/difficulty', methods=['GET'])
def get_difficulty():
    """Get current mining difficulty"""
    response = {
        'current_difficulty': blockchain.current_difficulty,
        'target_block_time': blockchain.difficulty_adjuster.target_block_time,
        'adjustment_interval': blockchain.difficulty_adjuster.adjustment_interval,
        'transaction_fee': blockchain.transaction_fee
    }
    return jsonify(response), 200

@app.route('/nodes/register', methods=['POST'])
def register_nodes():
    values = request.get_json()

    nodes = values.get('nodes')
    if nodes is None:
        return "Error: Please supply a valid list of nodes", 400

    for node in nodes:
        blockchain.register_node(node)

    response = {
        'message': 'New nodes have been added',
        'total_nodes': list(blockchain.nodes),
    }
    return jsonify(response), 201

@app.route('/nodes/resolve', methods=['GET'])
def consensus():
    replaced = blockchain.resolve_conflicts()

    if replaced:
        response = {
            'message': 'Our chain was replaced',
            'new_chain': [block.to_dict() for block in blockchain.chain]
        }
    else:
        response = {
            'message': 'Our chain is authoritative',
            'chain': [block.to_dict() for block in blockchain.chain]
        }

    return jsonify(response), 200

def run_single_node(port: int):
    app.run(host="0.0.0.0", port=port)

def launch_multi_node(n: int, base_port: int):
    import subprocess, time, requests, os, sys

    def wait_until_up(url, tries=60, delay=0.25):
        for _ in range(tries):
            try:
                requests.get(url, timeout=0.5)
                return True
            except Exception:
                time.sleep(delay)
        return False

    ports = [base_port + i for i in range(n)]
    procs = []

    try:
        # Start N nodes
        for p in ports:
            print(f"Starting node on port {p} ...")
            procs.append(
                subprocess.Popen([sys.executable, os.path.abspath(__file__), str(1), str(p)])
            )

        # Wait until each node responds
        for p in ports:
            url = f"http://127.0.0.1:{p}/chain"
            print(f"Waiting for {url} ...")
            if not wait_until_up(url):
                raise RuntimeError(f"Node at port {p} failed to start")

        # Register peers and create initial accounts
        all_urls = [f"http://127.0.0.1:{p}" for p in ports]
        for self_port in ports:
            peers = [u for u in all_urls if not u.endswith(f":{self_port}")]
            print(f"Registering {len(peers)} peers on {self_port} ...")
            try:
                r = requests.post(
                    f"http://127.0.0.1:{self_port}/nodes/register",
                    json={"nodes": peers},
                    timeout=3
                )
                r.raise_for_status()
            except requests.RequestException as e:
                print(f"Failed to register peers on port {self_port}: {e}")

        print("\nAll nodes up and networked ✅")
        first = ports[0]
        last = ports[-1]
        print("Try the advanced blockchain features:")
        print(f"  Invoke-RestMethod -Uri 'http://127.0.0.1:{first}/chain' -Method GET")
        print(f"  Invoke-RestMethod -Uri 'http://127.0.0.1:{first}/wallet/create' -Method POST")
        print(f"  Invoke-RestMethod -Uri 'http://127.0.0.1:{first}/contracts' -Method GET")
        print(f"  Invoke-RestMethod -Uri 'http://127.0.0.1:{first}/mine' -Method GET")
        print("Press Ctrl+C here to stop all nodes...")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        print("\nShutting down nodes ...")
        for p in procs:
            p.terminate()
        for p in procs:
            try:
                p.wait(timeout=3)
            except Exception:
                p.kill()

if __name__ == "__main__":
    import sys

    if len(sys.argv) == 1:
        run_single_node(5000)
    elif len(sys.argv) == 2:
        num_nodes = int(sys.argv[1])
        launch_multi_node(num_nodes, 5000)
    elif len(sys.argv) == 3:
        port = int(sys.argv[2])
        run_single_node(port)