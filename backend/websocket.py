import asyncio
import websockets
import json
import threading
import time
from datetime import datetime
from typing import Dict, Set, List
import logging

logger = logging.getLogger(__name__)

class P2PMessage:
    """P2P network message structure"""
    def __init__(self, message_type: str, data: dict, sender_id: str = None):
        self.type = message_type
        self.data = data
        self.sender_id = sender_id
        self.timestamp = time.time()
        self.message_id = f"{sender_id}_{self.timestamp}_{hash(str(data))}"
    
    def to_dict(self):
        return {
            'type': self.type,
            'data': self.data,
            'sender_id': self.sender_id,
            'timestamp': self.timestamp,
            'message_id': self.message_id
        }
    
    @classmethod
    def from_dict(cls, data):
        msg = cls(data['type'], data['data'], data['sender_id'])
        msg.timestamp = data['timestamp']
        msg.message_id = data['message_id']
        return msg

class PeerNode:
    """Represents a peer node in the network"""
    def __init__(self, node_id: str, address: str, port: int, websocket=None):
        self.node_id = node_id
        self.address = address
        self.port = port
        self.websocket = websocket
        self.last_seen = time.time()
        self.reputation = 100  # Start with good reputation
        self.is_connected = False
        self.failed_connections = 0
        self.version = "1.0"
    
    @property
    def url(self):
        return f"ws://{self.address}:{self.port}"
    
    def update_last_seen(self):
        self.last_seen = time.time()
    
    def increase_reputation(self, amount=1):
        self.reputation = min(100, self.reputation + amount)
    
    def decrease_reputation(self, amount=5):
        self.reputation = max(0, self.reputation - amount)
        if self.reputation < 20:
            logger.warning(f"Node {self.node_id} reputation very low: {self.reputation}")
    
    def to_dict(self):
        return {
            'node_id': self.node_id,
            'address': self.address,
            'port': self.port,
            'last_seen': self.last_seen,
            'reputation': self.reputation,
            'is_connected': self.is_connected,
            'version': self.version
        }

class P2PNetworkManager:
    """Advanced P2P networking with WebSockets and gossip protocol"""
    
    def __init__(self, blockchain, node_id: str, port: int = 8000):
        self.blockchain = blockchain
        self.node_id = node_id
        self.port = port
        self.peers: Dict[str, PeerNode] = {}
        self.known_peers: Set[str] = set()  # All peers we've ever heard of
        self.connected_peers: Set[str] = set()
        self.server = None
        self.running = False
        
        # Message handling
        self.seen_messages: Set[str] = set()  # Prevent message loops
        self.message_handlers = {
            'transaction': self._handle_new_transaction,      
            'block': self._handle_new_block,                  
            'new_transaction': self._handle_new_transaction,  
            'new_block': self._handle_new_block,              
            'peer_discovery': self._handle_peer_discovery,
            'chain_request': self._handle_chain_request,
            'chain_response': self._handle_chain_response,
            'ping': self._handle_ping,
            'pong': self._handle_pong,
        }
        
        # Bootstrap nodes (in production, these would be well-known addresses)
        self.bootstrap_nodes = [
            ('127.0.0.1', 8000),
            ('127.0.0.1', 8001),
            ('127.0.0.1', 8002),
        ]
        
        # Network stats
        self.messages_sent = 0
        self.messages_received = 0
        self.start_time = time.time()
    
    async def start_server(self):
        """Start the WebSocket server"""
        try:
            self.server = await websockets.serve(
                self._handle_connection,
                "0.0.0.0",
                self.port,
                ping_interval=30,
                ping_timeout=10
            )
            self.running = True
            logger.info(f"P2P server started on port {self.port}")
            
            # Start background tasks
            asyncio.create_task(self._discover_peers())
            asyncio.create_task(self._maintain_connections())
            asyncio.create_task(self._cleanup_old_messages())
            
        except Exception as e:
            logger.error(f"Failed to start P2P server: {e}")
    
    async def stop_server(self):
        """Stop the WebSocket server"""
        self.running = False
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        
        # Close all peer connections
        for peer in self.peers.values():
            if peer.websocket and not peer.websocket.closed:
                await peer.websocket.close()
    
    async def _handle_connection(self, websocket):
        """Handle incoming WebSocket connections"""
        peer_address = websocket.remote_address[0]
        logger.info(f"New connection from {peer_address}")
        
        try:
            async for raw_message in websocket:
                try:
                    message_data = json.loads(raw_message)
                    message = P2PMessage.from_dict(message_data)
                    
                    # Update or create peer
                    if message.sender_id:
                        if message.sender_id not in self.peers:
                            self.peers[message.sender_id] = PeerNode(
                                message.sender_id, 
                                peer_address, 
                                8000,  # Default port
                                websocket
                            )
                        self.peers[message.sender_id].update_last_seen()
                        self.peers[message.sender_id].is_connected = True
                        self.connected_peers.add(message.sender_id)
                    
                    await self._process_message(message, websocket)
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from {peer_address}")
                except Exception as e:
                    logger.error(f"Error processing message from {peer_address}: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Connection closed with {peer_address}")
        except Exception as e:
            logger.error(f"Connection error with {peer_address}: {e}")
        finally:
            # Clean up disconnected peer
            for peer_id, peer in list(self.peers.items()):
                if peer.websocket == websocket:
                    peer.is_connected = False
                    self.connected_peers.discard(peer_id)
    
    async def _process_message(self, message: P2PMessage, websocket):
        """Process incoming P2P message with enhanced debugging"""
        # Avoid processing the same message twice (gossip loop prevention)
        if message.message_id in self.seen_messages:
            logger.debug(f"Skipping duplicate message: {message.message_id}")
            return
        
        self.seen_messages.add(message.message_id)
        self.messages_received += 1
        
        # ADD THIS DEBUG LOGGING
        logger.info(f"Processing P2P message: type='{message.type}', sender='{message.sender_id}'")
        logger.debug(f"Message data keys: {list(message.data.keys()) if isinstance(message.data, dict) else 'Not a dict'}")
        
        # Handle the message
        handler = self.message_handlers.get(message.type)
        if handler:
            try:
                logger.info(f"Calling handler for message type: {message.type}")
                await handler(message, websocket)
                
                # Increase sender's reputation for valid messages
                if message.sender_id in self.peers:
                    self.peers[message.sender_id].increase_reputation()
                    
            except Exception as e:
                logger.error(f"Error handling {message.type}: {e}")
                logger.error(f"Full error traceback:", exc_info=True)  # This will show the full stack trace
                # Decrease sender's reputation for invalid messages
                if message.sender_id in self.peers:
                    self.peers[message.sender_id].decrease_reputation()
        else:
            logger.warning(f"Unknown message type: {message.type}")
            logger.warning(f"Available handlers: {list(self.message_handlers.keys())}")
        
        # Gossip: Forward message to other peers (except sender)
        await self._gossip_message(message, exclude_peer=message.sender_id)

    
    async def _gossip_message(self, message: P2PMessage, exclude_peer: str = None):
        """Forward message to other connected peers (gossip protocol)"""
        gossip_targets = []
        
        for peer_id, peer in self.peers.items():
            if (peer_id != exclude_peer and 
                peer_id != self.node_id and 
                peer.is_connected and 
                peer.websocket and 
                not peer.websocket.closed and
                peer.reputation > 20):  # Only gossip to reputable peers
                gossip_targets.append(peer)
        
        # Send to all eligible peers
        for peer in gossip_targets:
            try:
                await peer.websocket.send(json.dumps(message.to_dict()))
            except Exception as e:
                logger.warning(f"Failed to gossip to {peer.node_id}: {e}")
                peer.is_connected = False
                self.connected_peers.discard(peer.node_id)
    
    async def broadcast_transaction(self, transaction):
        """Broadcast new transaction to all peers"""
        message = P2PMessage(
            'new_transaction',
            transaction.to_dict() if hasattr(transaction, 'to_dict') else transaction,
            self.node_id
        )
        await self._gossip_message(message)
        logger.info(f"Broadcasted transaction {getattr(transaction, 'transaction_id', 'unknown')}")
    
    async def broadcast_block(self, block):
        """Broadcast new block to all peers"""
        message = P2PMessage(
            'new_block',
            block.to_dict() if hasattr(block, 'to_dict') else block,
            self.node_id
        )
        await self._gossip_message(message)
        logger.info(f"Broadcasted block {block.index}")
    
    async def request_chain_from_peers(self):
        """Request full chain from peers for consensus"""
        message = P2PMessage('chain_request', {}, self.node_id)
        await self._gossip_message(message)
    
    async def _discover_peers(self):
        """Discover new peers in the network"""
        while self.running:
            try:
                # Try to connect to bootstrap nodes
                for address, port in self.bootstrap_nodes:
                    if port != self.port:  # Don't connect to ourselves
                        await self._try_connect_peer(address, port)
                
                # Ask connected peers for their peer lists
                discovery_message = P2PMessage(
                    'peer_discovery',
                    {'known_peers': list(self.known_peers)},
                    self.node_id
                )
                await self._gossip_message(discovery_message)
                
                # Wait before next discovery round
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in peer discovery: {e}")
                await asyncio.sleep(10)
    
    async def _try_connect_peer(self, address: str, port: int):
        """Try to connect to a potential peer"""
        url = f"ws://{address}:{port}"
        
        try:
            websocket = await websockets.connect(url, ping_interval=30)
            
            # Send introduction
            intro_message = P2PMessage(
                'peer_discovery',
                {
                    'node_id': self.node_id,
                    'port': self.port,
                    'version': '1.0'
                },
                self.node_id
            )
            
            await websocket.send(json.dumps(intro_message.to_dict()))
            
            # Add to peers
            peer_id = f"{address}:{port}"
            if peer_id not in self.peers:
                self.peers[peer_id] = PeerNode(peer_id, address, port, websocket)
                self.connected_peers.add(peer_id)
                self.known_peers.add(f"{address}:{port}")
                logger.info(f"Connected to new peer: {peer_id}")
            
        except Exception as e:
            logger.debug(f"Could not connect to {url}: {e}")
    
    async def _maintain_connections(self):
        """Maintain connections with peers"""
        while self.running:
            try:
                current_time = time.time()
                
                # Send pings to connected peers
                ping_message = P2PMessage('ping', {'timestamp': current_time}, self.node_id)
                
                for peer_id, peer in list(self.peers.items()):
                    if peer.is_connected and peer.websocket and not peer.websocket.closed:
                        try:
                            await peer.websocket.send(json.dumps(ping_message.to_dict()))
                        except Exception as e:
                            logger.warning(f"Lost connection to {peer_id}: {e}")
                            peer.is_connected = False
                            self.connected_peers.discard(peer_id)
                    
                    # Remove peers that haven't been seen for too long
                    if current_time - peer.last_seen > 300:  # 5 minutes
                        logger.info(f"Removing stale peer: {peer_id}")
                        del self.peers[peer_id]
                        self.connected_peers.discard(peer_id)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error maintaining connections: {e}")
                await asyncio.sleep(30)
    
    async def _cleanup_old_messages(self):
        """Clean up old message IDs to prevent memory leak"""
        while self.running:
            try:
                # Keep only messages from last hour
                current_time = time.time()
                old_messages = {
                    msg_id for msg_id in self.seen_messages 
                    if current_time - float(msg_id.split('_')[1]) > 3600
                }
                self.seen_messages -= old_messages
                
                await asyncio.sleep(1800)  # Clean every 30 minutes
                
            except Exception as e:
                logger.error(f"Error cleaning old messages: {e}")
                await asyncio.sleep(300)
    
    async def _handle_new_transaction(self, message: P2PMessage, websocket):
        """Handle incoming transaction broadcast with better error handling"""
        try:
            logger.info(f"Received transaction from peer {message.sender_id}")
            
            tx_data = message.data
            logger.debug(f"Transaction data keys: {list(tx_data.keys()) if isinstance(tx_data, dict) else 'Not a dict'}")
            
            # Import all necessary transaction types
            try:
                from transactions import (
                    MultiSigTransaction, TimeLockTransaction, 
                    ContractDeployTransaction, ContractCallTransaction
                )
                from wallet import SecureTransaction
            except ImportError as e:
                logger.error(f"Failed to import transaction classes: {e}")
                return
            
            tx_type = tx_data.get('transaction_type')
            logger.info(f"Transaction type: {tx_type}")
            
            # Reconstruct transaction object based on type
            try:
                if tx_type == 'multisig':
                    tx = MultiSigTransaction.from_dict(tx_data)
                elif tx_type == 'timelock':
                    tx = TimeLockTransaction.from_dict(tx_data)
                elif tx_type == 'contract_deploy':
                    tx = ContractDeployTransaction.from_dict(tx_data)
                elif tx_type == 'contract_call':
                    tx = ContractCallTransaction.from_dict(tx_data)
                else:
                    # Regular SecureTransaction or simple dict transaction
                    if 'signature' in tx_data and 'sender_public_key' in tx_data:
                        tx = SecureTransaction.from_dict(tx_data)
                    else:
                        # Simple dictionary transaction
                        tx = tx_data
                        
                logger.info(f"Successfully reconstructed transaction object")
                
            except Exception as e:
                logger.error(f"Failed to reconstruct transaction: {e}")
                logger.debug(f"Transaction data was: {tx_data}")
                return
            
            # Check if transaction already exists
            tx_id = getattr(tx, 'transaction_id', None) or tx_data.get('transaction_id', str(tx))
            existing_tx_ids = [
                getattr(existing_tx, 'transaction_id', None) or 
                (existing_tx.get('transaction_id') if isinstance(existing_tx, dict) else str(existing_tx))
                for existing_tx in self.blockchain.current_transactions
            ]
            
            if tx_id in existing_tx_ids:
                logger.debug(f"Transaction {tx_id} already in mempool, skipping")
                return
            
            # Add to blockchain if valid and not already present
            try:
                self.blockchain.current_transactions.append(tx)
                logger.info(f"SUCCESS: Added transaction to mempool. Mempool size: {len(self.blockchain.current_transactions)}")
                
            except Exception as e:
                logger.error(f"Failed to add transaction to blockchain: {e}")
                raise
            
        except Exception as e:
            logger.error(f"Critical error handling transaction from {message.sender_id}: {e}")
            logger.error(f"Full error traceback:", exc_info=True)
            raise
    
    async def _handle_new_block(self, message: P2PMessage, websocket):
        """Handle incoming block broadcast with better error handling"""
        try:
            from enhanced_block import EnhancedBlock
            
            block_data = message.data
            logger.info(f"Received block from peer {message.sender_id}: Block #{block_data.get('index', 'unknown')}")
            logger.debug(f"Block data structure: {list(block_data.keys()) if isinstance(block_data, dict) else 'Not a dict'}")
            
            # Convert to EnhancedBlock object
            if isinstance(block_data, dict):
                try:
                    new_block = EnhancedBlock.from_dict(block_data)
                    logger.info(f"Successfully converted block data to EnhancedBlock object")
                except Exception as e:
                    logger.error(f"Failed to convert block data to EnhancedBlock: {e}")
                    logger.debug(f"Block data was: {block_data}")
                    return
            else:
                new_block = block_data
            
            current_chain_length = len(self.blockchain.chain)
            logger.info(f"Current chain length: {current_chain_length}, Received block index: {new_block.index}")
            
            # Check if this block extends our chain
            if new_block.index == current_chain_length:
                # This should be the next block
                if new_block.previous_hash == self.blockchain.last_block.hash:
                    
                    # Validate the block
                    if self._validate_received_block(new_block):
                        logger.info(f"Block validation successful. Adding block #{new_block.index} to chain")
                        
                        # Apply transactions to update state
                        for tx in new_block.transactions:
                            if self._is_valid_transaction_for_current_state(tx):
                                self.blockchain._update_state_with_transaction(tx)
                            else:
                                logger.warning(f"Invalid transaction in received block: {tx}")
                                return
                        
                        # Add block to chain
                        self.blockchain.chain.append(new_block)
                        
                        # Clear matching transactions from mempool
                        self._remove_mined_transactions(new_block.transactions)
                        
                        logger.info(f"SUCCESS: Added block #{new_block.index}. Chain length now: {len(self.blockchain.chain)}")
                        
                    else:
                        logger.warning(f"Block validation failed for block #{new_block.index} from {message.sender_id}")
                else:
                    logger.warning(f"Block {new_block.index} doesn't connect to our chain. Expected prev_hash: {self.blockchain.last_block.hash}, got: {new_block.previous_hash}")
            
            elif new_block.index > current_chain_length:
                # We're behind - request chain sync
                logger.info(f"Received block #{new_block.index} but our chain is only {current_chain_length}. Requesting chain sync.")
                await self.request_chain_from_peers()
            
            else:
                # Old block, ignore
                logger.debug(f"Received old block #{new_block.index}, ignoring")
                
        except Exception as e:
            logger.error(f"Critical error handling block from {message.sender_id}: {e}")
            logger.error(f"Full error traceback:", exc_info=True)

    def _validate_received_block(self, block):
        """Validate a block received from P2P network"""
        try:
            # Check proof of work
            if not self.blockchain.valid_proof(block.previous_hash, block.proof, block.difficulty):
                logger.warning(f"Invalid proof of work for block {block.index}")
                return False
            
            # Check merkle root
            if block.merkle_root != block.calculate_merkle_root():
                logger.warning(f"Invalid merkle root for block {block.index}")
                return False
            
            # Validate all transactions in the block
            for tx in block.transactions:
                if not self._is_valid_transaction_for_current_state(tx):
                    logger.warning(f"Invalid transaction in block {block.index}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating block: {e}")
            return False

    def _is_valid_transaction_for_current_state(self, transaction):
        """Check if transaction is valid against current blockchain state"""
        try:
            return self.blockchain._is_valid_transaction_for_state(transaction, self.blockchain.state)
        except Exception as e:
            logger.error(f"Error validating transaction: {e}")
            return False

    def _remove_mined_transactions(self, mined_transactions):
        """Remove mined transactions from mempool"""
        try:
            # Convert mined transactions to comparable format
            mined_tx_ids = set()
            for tx in mined_transactions:
                if hasattr(tx, 'transaction_id'):
                    mined_tx_ids.add(tx.transaction_id)
                elif isinstance(tx, dict) and 'transaction_id' in tx:
                    mined_tx_ids.add(tx['transaction_id'])
            
            # Remove matching transactions from mempool
            original_mempool_size = len(self.blockchain.current_transactions)
            self.blockchain.current_transactions = [
                tx for tx in self.blockchain.current_transactions
                if not (
                    (hasattr(tx, 'transaction_id') and tx.transaction_id in mined_tx_ids) or
                    (isinstance(tx, dict) and tx.get('transaction_id') in mined_tx_ids)
                )
            ]
            
            removed_count = original_mempool_size - len(self.blockchain.current_transactions)
            if removed_count > 0:
                logger.info(f"Removed {removed_count} mined transactions from mempool")
                
        except Exception as e:
            logger.error(f"Error removing mined transactions: {e}")
    async def _handle_peer_discovery(self, message: P2PMessage, websocket):
        """Handle peer discovery messages"""
        data = message.data
        
        # Add new peers to known peers
        if 'known_peers' in data:
            for peer_addr in data['known_peers']:
                self.known_peers.add(peer_addr)
        
        # Respond with our known peers
        response = P2PMessage(
            'peer_discovery',
            {'known_peers': list(self.known_peers)},
            self.node_id
        )
        await websocket.send(json.dumps(response.to_dict()))
    
    async def _handle_chain_request(self, message: P2PMessage, websocket):
        """Handle chain request from peer"""
        chain_data = [block.to_dict() for block in self.blockchain.chain]
        response = P2PMessage(
            'chain_response',
            {
                'chain': chain_data,
                'length': len(self.blockchain.chain)
            },
            self.node_id
        )
        await websocket.send(json.dumps(response.to_dict()))
    
    async def _handle_chain_response(self, message: P2PMessage, websocket):
        """Handle chain response for consensus"""
        try:
            data = message.data
            peer_chain = data['chain']
            peer_length = data['length']
            
            if peer_length > len(self.blockchain.chain):
                if self.blockchain.valid_chain(peer_chain):
                    logger.info(f"Adopting longer chain from {message.sender_id}")
                    from enhanced_block import EnhancedBlock
                    
                    self.blockchain.chain = [
                        EnhancedBlock.from_dict(block_data) 
                        for block_data in peer_chain
                    ]
                    self.blockchain._rebuild_state()
                else:
                    logger.warning(f"Rejected invalid chain from {message.sender_id}")
            
        except Exception as e:
            logger.error(f"Error handling chain response: {e}")
    
    async def _handle_ping(self, message: P2PMessage, websocket):
        """Handle ping message"""
        pong_message = P2PMessage('pong', {'timestamp': time.time()}, self.node_id)
        await websocket.send(json.dumps(pong_message.to_dict()))
    
    async def _handle_pong(self, message: P2PMessage, websocket):
        """Handle pong message"""
        # Update peer's last seen time
        if message.sender_id in self.peers:
            self.peers[message.sender_id].update_last_seen()
    
    def get_network_stats(self):
        """Get network statistics"""
        uptime = time.time() - self.start_time
        return {
            'node_id': self.node_id,
            'port': self.port,
            'uptime_seconds': uptime,
            'connected_peers': len(self.connected_peers),
            'known_peers': len(self.known_peers),
            'messages_sent': self.messages_sent,
            'messages_received': self.messages_received,
            'peer_list': [peer.to_dict() for peer in self.peers.values()]
        }

# Utility function to start P2P networking in a separate thread
def start_p2p_networking(blockchain, node_id, port=8000):
    """Start P2P networking in background thread"""
    
    def run_p2p():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        p2p_manager = P2PNetworkManager(blockchain, node_id, port)
        
        try:
            loop.run_until_complete(p2p_manager.start_server())
            loop.run_forever()
        except KeyboardInterrupt:
            loop.run_until_complete(p2p_manager.stop_server())
        finally:
            loop.close()
    
    thread = threading.Thread(target=run_p2p, daemon=True)
    thread.start()
    
    return thread

# Test the P2P networking
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Mock blockchain for testing
    class MockBlockchain:
        def __init__(self):
            self.chain = []
            self.current_transactions = []
        
        def new_transaction(self, tx):
            self.current_transactions.append(tx)
            print(f"Added transaction: {getattr(tx, 'transaction_id', 'unknown')}")
    
    blockchain = MockBlockchain()
    
    async def test_p2p():
        p2p = P2PNetworkManager(blockchain, "test_node", 8000)
        await p2p.start_server()
        
        print("P2P server running... Press Ctrl+C to stop")
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            await p2p.stop_server()
    
    asyncio.run(test_p2p())