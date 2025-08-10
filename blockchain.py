import hashlib
import json
from textwrap import dedent
from time import time
from uuid import uuid4
from flask import Flask, jsonify, request
from urllib.parse import urlparse
import requests

class Blockchain(object):
    def __init__(self):
        self.chain = []
        self.current_transactions = []
        self.nodes = set()
        # Initialize with genesis block and proper state tracking
        self.state = {}
        self._create_genesis_block()
    
    def _create_genesis_block(self):
        """Create the genesis block with initial state"""
        # Initialize accounts for demonstration
        genesis_state = {'system': 1000}  # System starts with initial supply
        self.state = genesis_state.copy()
        
        genesis_block = self.new_block(
            proof=100, 
            previous_hash='1',
            transactions=[genesis_state]  # Genesis transaction
        )
        return genesis_block

    def new_block(self, proof, previous_hash=None, transactions=None):
        """
        Create a new Block in the Blockchain with improved structure
        """
        # Use provided transactions or current pending transactions
        block_transactions = transactions if transactions else self.current_transactions.copy()
        
        block = {
            'index': len(self.chain) + 1,
            'timestamp': time(),
            'transactions': block_transactions,
            'proof': proof,
            'previous_hash': previous_hash or self.hash(self.chain[-1]) if self.chain else '1',
            'transaction_count': len(block_transactions)
        }

        # Only reset pending transactions if we used them
        if transactions is None:
            self.current_transactions = []

        self.chain.append(block)
        return block

    def new_transaction(self, sender, recipient, amount):
        """
        Creates a new transaction with validation
        """
        # Validate transaction before adding
        transaction = {
            'sender': sender,
            'recipient': recipient,
            'amount': amount,
            'timestamp': time()
        }
        
        if self._is_valid_transaction(transaction):
            self.current_transactions.append(transaction)
            return self.last_block['index'] + 1
        else:
            raise ValueError("Invalid transaction: insufficient funds or invalid parameters")

    def _is_valid_transaction(self, transaction):
        """
        Validate a single transaction against current state
        """
        sender = transaction['sender']
        amount = transaction['amount']
        
        # Mining reward transactions (sender = "0") are always valid
        if sender == "0":
            return True
            
        # Check if sender exists and has sufficient balance
        if sender not in self.state:
            return False
            
        return self.state[sender] >= amount and amount > 0

    def _update_state(self, transaction):
        """
        Update the blockchain state with a transaction
        """
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

    def get_balance(self, address):
        """Get the current balance of an address"""
        return self.state.get(address, 0)

    def validate_and_update_state(self, transactions):
        """
        Validate all transactions in a block and update state
        """
        temp_state = self.state.copy()
        
        for txn in transactions:
            if not self._is_valid_transaction(txn):
                return False
            # Update temporary state
            sender = txn['sender']
            recipient = txn['recipient'] 
            amount = txn['amount']
            
            if sender == "0":  # Mining reward
                if recipient not in temp_state:
                    temp_state[recipient] = 0
                temp_state[recipient] += amount
            else:
                temp_state[sender] -= amount
                if recipient not in temp_state:
                    temp_state[recipient] = 0
                temp_state[recipient] += amount
        
        # If all transactions are valid, update the actual state
        self.state = temp_state
        return True

    @property
    def last_block(self):
        return self.chain[-1]

    @staticmethod
    def hash(block):
        """
        Creates a SHA-256 hash of a Block
        """
        block_string = json.dumps(block, sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()

    def proof_of_work(self, last_proof):
        """
        Improved Proof of Work with configurable difficulty
        """
        proof = 0
        while self.valid_proof(last_proof, proof) is False:
            proof += 1
        return proof

    @staticmethod
    def valid_proof(last_proof, proof, difficulty=4):
        """
        Validates the Proof with configurable difficulty
        """
        guess = f'{last_proof}{proof}'.encode()
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

    def valid_chain(self, chain):
        """
        Improved chain validation with state verification
        """
        if not chain:
            return False
            
        # Check genesis block
        if len(chain) == 0:
            return False
            
        # Reset state for validation
        temp_state = {}
        
        # Process genesis block
        genesis_block = chain[0]
        if genesis_block['previous_hash'] != '1':
            return False
            
        # Initialize state from genesis
        for txn in genesis_block['transactions']:
            if isinstance(txn, dict) and all(isinstance(v, (int, float)) for v in txn.values()):
                temp_state.update(txn)
        
        last_block = genesis_block
        current_index = 1

        while current_index < len(chain):
            block = chain[current_index]
            
            # Check that the hash of the block is correct
            if block['previous_hash'] != self.hash(last_block):
                return False

            # Check that the Proof of Work is correct
            if not self.valid_proof(last_block['proof'], block['proof']):
                return False
                
            # Validate transactions in this block
            for txn in block['transactions']:
                if not self._validate_transaction_against_state(txn, temp_state):
                    return False
                self._apply_transaction_to_state(txn, temp_state)

            last_block = block
            current_index += 1

        return True
    
    def _validate_transaction_against_state(self, transaction, state):
        """Validate transaction against a given state"""
        sender = transaction['sender']
        amount = transaction['amount']
        
        if sender == "0":  # Mining reward
            return True
            
        return sender in state and state[sender] >= amount and amount > 0
    
    def _apply_transaction_to_state(self, transaction, state):
        """Apply transaction to a given state"""
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

    def resolve_conflicts(self):
        """
        Improved consensus algorithm that validates state
        """
        neighbours = self.nodes
        new_chain = None

        max_length = len(self.chain)

        for node in neighbours:
            try:
                response = requests.get(f'http://{node}/chain', timeout=5)
                
                if response.status_code == 200:
                    length = response.json()['length']
                    chain = response.json()['chain']

                    # Check if the length is longer and the chain is valid
                    if length > max_length and self.valid_chain(chain):
                        max_length = length
                        new_chain = chain
            except requests.RequestException:
                continue  # Skip unreachable nodes

        # Replace our chain if we discovered a new, valid chain longer than ours
        if new_chain:
            self.chain = new_chain
            self._rebuild_state()
            return True

        return False
    
    def _rebuild_state(self):
        """Rebuild state from the current chain"""
        self.state = {}
        
        for block in self.chain:
            for txn in block['transactions']:
                if isinstance(txn, dict) and 'sender' in txn:
                    self._update_state(txn)
                else:
                    # Genesis block format
                    self.state.update(txn)

app = Flask(__name__)
node_identifier = str(uuid4()).replace('-', '')

# Instantiate the Blockchain
blockchain = Blockchain()

@app.route('/mine', methods=['GET'])
def mine():
    # We run the proof of work algorithm to get the next proof
    last_block = blockchain.last_block
    last_proof = last_block['proof']
    proof = blockchain.proof_of_work(last_proof)

    # Mining reward
    blockchain.new_transaction(
        sender="0",
        recipient=node_identifier,
        amount=1,
    )

    # Forge the new Block
    previous_hash = blockchain.hash(last_block)
    block = blockchain.new_block(proof, previous_hash)

    response = {
        'message': "New Block Forged",
        'index': block['index'],
        'transactions': block['transactions'],
        'proof': block['proof'],
        'previous_hash': block['previous_hash'],
    }
    return jsonify(response), 200

@app.route('/transactions/new', methods=['POST'])
def new_transaction():
    values = request.get_json()

    required = ['sender', 'recipient', 'amount']
    if not all(k in values for k in required):
        return 'Missing values', 400

    try:
        index = blockchain.new_transaction(
            values['sender'], 
            values['recipient'], 
            values['amount']
        )
        response = {'message': f'Transaction will be added to Block {index}'}
        return jsonify(response), 201
    except ValueError as e:
        return str(e), 400

@app.route('/chain', methods=['GET'])
def full_chain():
    response = {
        'chain': blockchain.chain,
        'length': len(blockchain.chain),
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
            'new_chain': blockchain.chain
        }
    else:
        response = {
            'message': 'Our chain is authoritative',
            'chain': blockchain.chain
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
        print("Try:")
        print(f"  curl http://127.0.0.1:{first}/chain")
        print(f"  curl http://127.0.0.1:{first}/state")
        print(f"  curl http://127.0.0.1:{first}/balance/system")
        print(f"  curl -X POST -H \"Content-Type: application/json\" "
              f"-d '{{\"sender\":\"system\",\"recipient\":\"alice\",\"amount\":50}}' "
              f"http://127.0.0.1:{first}/transactions/new")
        print(f"  curl http://127.0.0.1:{first}/mine")
        print(f"  curl http://127.0.0.1:{last}/nodes/resolve")
        print(f"  curl http://127.0.0.1:{first}/balance/alice\n")
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
