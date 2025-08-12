import hashlib
import json
import time
from wallet import Wallet, SecureTransaction

class MultiSigTransaction(SecureTransaction):
    def __init__(self, sender_addresses, recipient, amount, required_signatures=None):
        """Multi-signature transaction requiring multiple signatures"""
        self.sender_addresses = sender_addresses
        self.recipient = recipient
        self.amount = amount
        self.required_signatures = required_signatures or len(sender_addresses)  # Default: all must sign
        self.timestamp = time.time()
        self.transaction_id = self.calculate_hash()
        self.signatures = {}  # Dictionary: address -> signature
        self.public_keys = {}  # Dictionary: address -> public_key
        self.transaction_type = "multisig"
    
    def calculate_hash(self):
        """Calculate transaction hash"""
        transaction_data = {
            'sender_addresses': sorted(self.sender_addresses),
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'required_signatures': self.required_signatures,
            'type': 'multisig'
        }
        return hashlib.sha256(json.dumps(transaction_data, sort_keys=True).encode()).hexdigest()
    
    def sign_transaction(self, wallet):
        """Sign the transaction with a wallet"""
        if wallet.address not in self.sender_addresses:
            raise ValueError("Wallet address not in sender list")
        
        transaction_data = {
            'sender_addresses': sorted(self.sender_addresses),
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'required_signatures': self.required_signatures
        }
        
        self.signatures[wallet.address] = wallet.sign_transaction(transaction_data)
        self.public_keys[wallet.address] = wallet.get_public_key_pem()
    
    def verify_transaction(self):
        """Verify all signatures and check if enough signatures collected"""
        if len(self.signatures) < self.required_signatures:
            return False
        
        transaction_data = {
            'sender_addresses': sorted(self.sender_addresses),
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'required_signatures': self.required_signatures
        }
        
        valid_signatures = 0
        for address in self.signatures:
            if address in self.public_keys:
                if Wallet.verify_signature(transaction_data, self.signatures[address], self.public_keys[address]):
                    valid_signatures += 1
        
        return valid_signatures >= self.required_signatures
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'sender_addresses': self.sender_addresses,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'required_signatures': self.required_signatures,
            'signatures': self.signatures,
            'public_keys': self.public_keys,
            'transaction_type': self.transaction_type
        }

class TimeLockTransaction(SecureTransaction):
    def __init__(self, sender, recipient, amount, unlock_time, sender_wallet=None):
        """Time-locked transaction that can only be used after unlock_time"""
        self.unlock_time = unlock_time  # Set unlock_time first
        self.transaction_type = "timelock"
        super().__init__(sender, recipient, amount, sender_wallet)
    
    def calculate_hash(self):
        """Calculate transaction hash including unlock time"""
        transaction_data = {
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'timestamp': self.timestamp,
            'unlock_time': self.unlock_time,
            'type': 'timelock'
        }
        return hashlib.sha256(json.dumps(transaction_data, sort_keys=True).encode()).hexdigest()
    
    def is_unlocked(self):
        """Check if transaction is unlocked (current time >= unlock_time)"""
        return time.time() >= self.unlock_time
    
    def verify_transaction(self):
        """Verify signature and check if unlocked"""
        if not self.is_unlocked():
            return False
        return super().verify_transaction()
    
    def to_dict(self):
        """Convert to dictionary"""
        base_dict = super().to_dict()
        base_dict.update({
            'unlock_time': self.unlock_time,
            'transaction_type': self.transaction_type
        })
        return base_dict

class SmartContract:
    def __init__(self, contract_code, creator_address):
        """Basic smart contract"""
        self.contract_code = contract_code
        self.creator_address = creator_address
        self.contract_address = self.generate_contract_address()
        self.state = {}  # Contract state storage
        self.balance = 0
        self.created_at = time.time()
    
    def generate_contract_address(self):
        """Generate contract address from code and creator"""
        data = f"{self.creator_address}{self.contract_code}{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()[:20]
    
    def execute(self, function_name, parameters, caller_address, value=0):
        """Execute a contract function (simplified)"""
        try:
            # This is a very basic smart contract VM
            # In reality, you'd have a proper virtual machine
            
            if function_name == "set_value":
                key = parameters.get('key')
                val = parameters.get('value')
                if key and val is not None:
                    self.state[key] = val
                    return {"success": True, "message": f"Set {key} = {val}"}
            
            elif function_name == "get_value":
                key = parameters.get('key')
                if key in self.state:
                    return {"success": True, "value": self.state[key]}
                else:
                    return {"success": False, "message": "Key not found"}
            
            elif function_name == "transfer":
                recipient = parameters.get('recipient')
                amount = parameters.get('amount', 0)
                if self.balance >= amount and amount > 0:
                    self.balance -= amount
                    return {"success": True, "message": f"Transferred {amount} to {recipient}", "transfer": {"to": recipient, "amount": amount}}
                else:
                    return {"success": False, "message": "Insufficient contract balance"}
            
            elif function_name == "deposit":
                self.balance += value
                return {"success": True, "message": f"Deposited {value}", "new_balance": self.balance}
            
            else:
                return {"success": False, "message": f"Function {function_name} not found"}
                
        except Exception as e:
            return {"success": False, "message": f"Execution error: {str(e)}"}
    
    def to_dict(self):
        """Convert contract to dictionary"""
        return {
            'contract_address': self.contract_address,
            'contract_code': self.contract_code,
            'creator_address': self.creator_address,
            'state': self.state,
            'balance': self.balance,
            'created_at': self.created_at
        }

class ContractDeployTransaction(SecureTransaction):
    def __init__(self, creator_address, contract_code, initial_value=0, creator_wallet=None):
        """Transaction to deploy a smart contract"""
        self.creator_address = creator_address
        self.contract_code = contract_code
        self.initial_value = initial_value
        self.timestamp = time.time()
        self.transaction_id = self.calculate_hash()
        self.signature = None
        self.sender_public_key = None
        self.transaction_type = "contract_deploy"
        
        # Create the contract
        self.contract = SmartContract(contract_code, creator_address)
        
        if creator_wallet:
            self.sign_transaction(creator_wallet)
    
    def calculate_hash(self):
        """Calculate transaction hash"""
        transaction_data = {
            'creator_address': self.creator_address,
            'contract_code': self.contract_code,
            'initial_value': self.initial_value,
            'timestamp': self.timestamp,
            'type': 'contract_deploy'
        }
        return hashlib.sha256(json.dumps(transaction_data, sort_keys=True).encode()).hexdigest()
    
    def sign_transaction(self, wallet):
        """Sign the contract deployment"""
        if wallet.address != self.creator_address:
            raise ValueError("Only creator can sign deployment")
        
        transaction_data = {
            'creator_address': self.creator_address,
            'contract_code': self.contract_code,
            'initial_value': self.initial_value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        self.signature = wallet.sign_transaction(transaction_data)
        self.sender_public_key = wallet.get_public_key_pem()
    
    def verify_transaction(self):
        """Verify contract deployment signature"""
        if not self.signature or not self.sender_public_key:
            return False
        
        transaction_data = {
            'creator_address': self.creator_address,
            'contract_code': self.contract_code,
            'initial_value': self.initial_value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        return Wallet.verify_signature(transaction_data, self.signature, self.sender_public_key)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'creator_address': self.creator_address,
            'contract_code': self.contract_code,
            'initial_value': self.initial_value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'signature': self.signature,
            'sender_public_key': self.sender_public_key,
            'transaction_type': self.transaction_type,
            'contract_address': self.contract.contract_address
        }

class ContractCallTransaction(SecureTransaction):
    def __init__(self, caller_address, contract_address, function_name, parameters, value=0, caller_wallet=None):
        """Transaction to call a smart contract function"""
        self.caller_address = caller_address
        self.contract_address = contract_address
        self.function_name = function_name
        self.parameters = parameters
        self.value = value  # Amount sent with the call
        self.timestamp = time.time()
        self.transaction_id = self.calculate_hash()
        self.signature = None
        self.sender_public_key = None
        self.transaction_type = "contract_call"
        
        if caller_wallet:
            self.sign_transaction(caller_wallet)
    
    def calculate_hash(self):
        """Calculate transaction hash"""
        transaction_data = {
            'caller_address': self.caller_address,
            'contract_address': self.contract_address,
            'function_name': self.function_name,
            'parameters': self.parameters,
            'value': self.value,
            'timestamp': self.timestamp,
            'type': 'contract_call'
        }
        return hashlib.sha256(json.dumps(transaction_data, sort_keys=True).encode()).hexdigest()
    
    def sign_transaction(self, wallet):
        """Sign the contract call"""
        if wallet.address != self.caller_address:
            raise ValueError("Only caller can sign contract call")
        
        transaction_data = {
            'caller_address': self.caller_address,
            'contract_address': self.contract_address,
            'function_name': self.function_name,
            'parameters': self.parameters,
            'value': self.value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        self.signature = wallet.sign_transaction(transaction_data)
        self.sender_public_key = wallet.get_public_key_pem()
    
    def verify_transaction(self):
        """Verify contract call signature"""
        if not self.signature or not self.sender_public_key:
            return False
        
        transaction_data = {
            'caller_address': self.caller_address,
            'contract_address': self.contract_address,
            'function_name': self.function_name,
            'parameters': self.parameters,
            'value': self.value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id
        }
        
        return Wallet.verify_signature(transaction_data, self.signature, self.sender_public_key)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'caller_address': self.caller_address,
            'contract_address': self.contract_address,
            'function_name': self.function_name,
            'parameters': self.parameters,
            'value': self.value,
            'timestamp': self.timestamp,
            'transaction_id': self.transaction_id,
            'signature': self.signature,
            'sender_public_key': self.sender_public_key,
            'transaction_type': self.transaction_type
        }

# Test the advanced transactions
if __name__ == "__main__":
    from wallet import create_wallet
    
    print("Testing Advanced Transactions...")
    
    # Create test wallets
    alice = create_wallet()
    bob = create_wallet()
    charlie = create_wallet()
    
    print(f"Alice: {alice.address}")
    print(f"Bob: {bob.address}")
    print(f"Charlie: {charlie.address}")
    
    # Test Multi-sig transaction
    print("\n1. Testing Multi-sig Transaction...")
    multisig_tx = MultiSigTransaction([alice.address, bob.address], charlie.address, 100, required_signatures=2)
    multisig_tx.sign_transaction(alice)
    multisig_tx.sign_transaction(bob)
    print(f"Multi-sig valid: {multisig_tx.verify_transaction()}")
    
    # Test Time-lock transaction
    print("\n2. Testing Time-lock Transaction...")
    future_time = time.time() + 60  # 1 minute in the future
    timelock_tx = TimeLockTransaction(alice.address, bob.address, 50, future_time, alice)
    print(f"Time-lock valid now: {timelock_tx.verify_transaction()}")
    print(f"Time-lock unlocked: {timelock_tx.is_unlocked()}")
    
    # Test Smart Contract
    print("\n3. Testing Smart Contract...")
    contract_code = "basic_storage_contract"
    deploy_tx = ContractDeployTransaction(alice.address, contract_code, 0, alice)
    print(f"Contract deploy valid: {deploy_tx.verify_transaction()}")
    print(f"Contract address: {deploy_tx.contract.contract_address}")
    
    # Test contract call
    call_tx = ContractCallTransaction(
        alice.address, 
        deploy_tx.contract.contract_address, 
        "set_value", 
        {"key": "greeting", "value": "Hello World!"}, 
        0, 
        alice
    )
    print(f"Contract call valid: {call_tx.verify_transaction()}")
    
    print("\nAll advanced transaction types working! ✅")