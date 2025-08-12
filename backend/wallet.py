import hashlib
import json
import time
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key, load_pem_public_key
import base64
import binascii

class Wallet:
    def __init__(self, private_key=None):
        if private_key:
            self.private_key = load_pem_private_key(private_key.encode(), password=None)
        else:
            self.private_key = ec.generate_private_key(ec.SECP256K1())
        
        self.public_key = self.private_key.public_key()
        self.address = self.generate_address()
    
    def generate_address(self):
        """Generate a wallet address from public key"""
        public_key_bytes = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        # Create address by double hashing the public key (like Bitcoin)
        hash_obj = hashlib.sha256(public_key_bytes).digest()
        hash_obj = hashlib.sha256(hash_obj).digest()  # Double SHA256
        
        # Convert to hex and take first 20 characters for readability
        return hash_obj.hex()[:20]
    
    def get_private_key_pem(self):
        """Export private key in PEM format"""
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode()
    
    def get_public_key_pem(self):
        """Export public key in PEM format"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
    
    def sign_transaction(self, transaction_data):
        """Sign transaction data with private key"""
        message = json.dumps(transaction_data, sort_keys=True).encode()
        signature = self.private_key.sign(message, ec.ECDSA(hashes.SHA256()))
        return base64.b64encode(signature).decode()
    
    @staticmethod
    def verify_signature(transaction_data, signature, public_key_pem):
        """Verify a transaction signature"""
        try:
            public_key = load_pem_public_key(public_key_pem.encode())
            message = json.dumps(transaction_data, sort_keys=True).encode()
            signature_bytes = base64.b64decode(signature)
            public_key.verify(signature_bytes, message, ec.ECDSA(hashes.SHA256()))
            return True
        except Exception:
            return False

class SecureTransaction:
    def __init__(self, sender_address, recipient_address, amount, sender_wallet=None):
        self.sender = sender_address
        self.recipient = recipient_address
        self.amount = amount
        self.timestamp = time.time()
        self.transaction_id = self.calculate_hash()
        self.signature = None
        self.sender_public_key = None
        
        if sender_wallet:
            self.sign_transaction(sender_wallet)
    
    def calculate_hash(self):
        """Calculate transaction hash"""
        transaction_data = {
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp
        }
        return hashlib.sha256(json.dumps(transaction_data, sort_keys=True).encode()).hexdigest()
    
    def sign_transaction(self, wallet):
        """Sign the transaction with sender's wallet"""
        if wallet.address != self.sender:
            raise ValueError("Cannot sign transaction for different wallet")
        
        transaction_data = {
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        self.signature = wallet.sign_transaction(transaction_data)
        self.sender_public_key = wallet.get_public_key_pem()
    
    def verify_transaction(self):
        """Verify the transaction signature"""
        if not self.signature or not self.sender_public_key:
            return False
        
        # Special case for mining rewards (sender = "0")
        if self.sender == "0":
            return True
        
        transaction_data = {
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        return Wallet.verify_signature(transaction_data, self.signature, self.sender_public_key)
    
    def to_dict(self):
        """Convert transaction to dictionary"""
        return {
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'signature': self.signature,
            'sender_public_key': self.sender_public_key
        }
    
    @staticmethod
    def from_dict(data):
        """Create transaction from dictionary"""
        tx = SecureTransaction(data['sender'], data['recipient'], data['amount'])
        tx.timestamp = data['timestamp']
        tx.transaction_id = data['transaction_id']
        tx.signature = data.get('signature')
        tx.sender_public_key = data.get('sender_public_key')
        return tx

# Utility functions for the main blockchain
def create_wallet():
    """Create a new wallet"""
    return Wallet()

def load_wallet_from_private_key(private_key_pem):
    """Load wallet from private key"""
    return Wallet(private_key_pem)

def generate_genesis_wallet():
    """Generate the genesis wallet for initial token distribution"""
    return Wallet()

# Example usage
if __name__ == "__main__":
    # Create wallets
    alice_wallet = create_wallet()
    bob_wallet = create_wallet()
    
    print(f"Alice's address: {alice_wallet.address}")
    print(f"Bob's address: {bob_wallet.address}")
    
    # Create and sign a transaction
    tx = SecureTransaction(alice_wallet.address, bob_wallet.address, 50, alice_wallet)
    print(f"Transaction signed: {tx.verify_transaction()}")
    print(f"Transaction data: {tx.to_dict()}")