import hashlib
import json
from time import time

class EnhancedBlock:
    def __init__(self, index, transactions, proof, previous_hash, miner_address, difficulty=4):
        self.index = index
        self.timestamp = time()
        self.transactions = transactions
        self.proof = proof
        self.previous_hash = previous_hash
        self.miner_address = miner_address
        self.difficulty = difficulty
        self.nonce = 0
        self.merkle_root = self.calculate_merkle_root()
        self.hash = self.calculate_hash()
    
    def calculate_merkle_root(self):
        """Calculate Merkle root of transactions"""
        if not self.transactions:
            return hashlib.sha256(b'').hexdigest()
        
        # Get transaction hashes
        tx_hashes = []
        for tx in self.transactions:
            if hasattr(tx, 'to_dict'):
                tx_data = json.dumps(tx.to_dict(), sort_keys=True)
            elif isinstance(tx, dict):
                tx_data = json.dumps(tx, sort_keys=True)
            else:
                tx_data = str(tx)
            tx_hashes.append(hashlib.sha256(tx_data.encode()).hexdigest())
        
        # Build Merkle tree
        while len(tx_hashes) > 1:
            if len(tx_hashes) % 2 != 0:
                tx_hashes.append(tx_hashes[-1])  # Duplicate last hash if odd number
            
            new_level = []
            for i in range(0, len(tx_hashes), 2):
                combined = tx_hashes[i] + tx_hashes[i + 1]
                new_level.append(hashlib.sha256(combined.encode()).hexdigest())
            tx_hashes = new_level
        
        return tx_hashes[0] if tx_hashes else hashlib.sha256(b'').hexdigest()
    
    def calculate_hash(self):
        """Calculate block hash"""
        block_data = {
            'index': self.index,
            'timestamp': self.timestamp,
            'merkle_root': self.merkle_root,
            'proof': self.proof,
            'previous_hash': self.previous_hash,
            'nonce': self.nonce,
            'difficulty': self.difficulty,
            'miner_address': self.miner_address
        }
        return hashlib.sha256(json.dumps(block_data, sort_keys=True).encode()).hexdigest()
    
    def to_dict(self):
        """Convert block to dictionary for JSON serialization"""
        return {
            'index': self.index,
            'timestamp': self.timestamp,
            'transactions': [
                tx.to_dict() if hasattr(tx, 'to_dict') else tx 
                for tx in self.transactions
            ],
            'proof': self.proof,
            'previous_hash': self.previous_hash,
            'miner_address': self.miner_address,
            'difficulty': self.difficulty,
            'nonce': self.nonce,
            'merkle_root': self.merkle_root,
            'hash': self.hash,
            'transaction_count': len(self.transactions)
        }
    
    @staticmethod
    def from_dict(block_data):
        """Create EnhancedBlock from dictionary"""
        # Import here to avoid circular imports
        from wallet import SecureTransaction
        
        # Convert transaction data back to objects
        transactions = []
        for tx_data in block_data['transactions']:
            if isinstance(tx_data, dict) and 'signature' in tx_data:
                # It's a SecureTransaction
                tx = SecureTransaction.from_dict(tx_data)
                transactions.append(tx)
            else:
                # It's a regular dict transaction
                transactions.append(tx_data)
        
        block = EnhancedBlock(
            block_data['index'],
            transactions,
            block_data['proof'],
            block_data['previous_hash'],
            block_data.get('miner_address', 'unknown'),
            block_data.get('difficulty', 4)
        )
        
        # Set the values that were calculated during creation
        block.timestamp = block_data['timestamp']
        block.nonce = block_data.get('nonce', 0)
        block.merkle_root = block_data.get('merkle_root', block.calculate_merkle_root())
        block.hash = block_data.get('hash', block.calculate_hash())
        
        return block

class DifficultyAdjustment:
    def __init__(self, target_block_time=10, adjustment_interval=10):
        self.target_block_time = target_block_time  # seconds
        self.adjustment_interval = adjustment_interval  # blocks
        self.min_difficulty = 1
        self.max_difficulty = 10
    
    def adjust_difficulty(self, blockchain):
        """Adjust difficulty based on recent block times"""
        if len(blockchain.chain) < self.adjustment_interval:
            return 4  # Default difficulty
        
        # Get recent blocks
        recent_blocks = blockchain.chain[-self.adjustment_interval:]
        
        # Calculate actual time taken
        time_taken = recent_blocks[-1].timestamp - recent_blocks[0].timestamp
        expected_time = self.target_block_time * (self.adjustment_interval - 1)
        
        # Get current difficulty
        current_difficulty = recent_blocks[-1].difficulty
        
        # Adjust difficulty
        if time_taken < expected_time / 2:
            # Blocks are being mined too fast, increase difficulty
            new_difficulty = min(current_difficulty + 1, self.max_difficulty)
        elif time_taken > expected_time * 2:
            # Blocks are being mined too slow, decrease difficulty
            new_difficulty = max(current_difficulty - 1, self.min_difficulty)
        else:
            # Difficulty is about right
            new_difficulty = current_difficulty
        
        if new_difficulty != current_difficulty:
            print(f"Difficulty adjusted from {current_difficulty} to {new_difficulty}")
            print(f"Time taken: {time_taken:.1f}s, Expected: {expected_time:.1f}s")
        
        return new_difficulty

# Test the enhanced block
if __name__ == "__main__":
    from wallet import SecureTransaction, create_wallet
    
    print("Testing Enhanced Block...")
    
    # Create test transactions
    alice = create_wallet()
    bob = create_wallet()
    
    tx1 = SecureTransaction(alice.address, bob.address, 50, alice)
    tx2 = {'sender': '0', 'recipient': alice.address, 'amount': 10, 'timestamp': time()}
    
    transactions = [tx1, tx2]
    
    # Create enhanced block
    block = EnhancedBlock(
        index=1,
        transactions=transactions,
        proof=12345,
        previous_hash="previous_block_hash",
        miner_address=alice.address,
        difficulty=4
    )
    
    print(f"Block hash: {block.hash}")
    print(f"Merkle root: {block.merkle_root}")
    print(f"Block created successfully!")
    
    # Test serialization
    block_dict = block.to_dict()
    reconstructed_block = EnhancedBlock.from_dict(block_dict)
    
    print(f"Serialization test: {block.hash == reconstructed_block.hash}")