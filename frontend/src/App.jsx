import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, Server, Coins, Users, Hash, Clock, AlertCircle, CheckCircle, 
  RefreshCw, Plus, Send, Eye, TrendingUp, Zap, Network, BarChart3, 
  Target, Cpu, Search, Radio, Map, Layers, List 
} from 'lucide-react';
// Color palette
const COLORS = {
  panel: 'rgba(0,0,0,0.5)',
  border: 'rgba(255,255,255,0.1)',
  white: '#ffffff',
  green: '#00ff88',
  red: '#ff4444',
  textMuted: 'rgba(255,255,255,0.4)',
  textDim: 'rgba(255,255,255,0.7)'
};

// Badge style helper
const badge = (bg, color) => ({
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 12,
  background: bg,
  color: color,
  fontSize: 12,
  fontWeight: 600
});
const FuturisticBlockchainDashboard = () => {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ sender: '', recipient: '', amount: '' });
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [globalState, setGlobalState] = useState({});
  const [activeView, setActiveView] = useState('overview');
  const [blockSearch, setBlockSearch] = useState('');
  const [mempool, setMempool] = useState([]);
  const [topology, setTopology] = useState({ nodes: [], edges: [] });
  const [events, setEvents] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    totalNodes: 0,
    totalBlocks: 0,
    totalTransactions: 0,
    networkHealth: 'Unknown',
    healthPercentage: 0,
    hashRate: 0,
    difficulty: 4
  });

  // Refs for tracking changes
  const prevMempoolRef = useRef(new Set());
  const prevBestHeightRef = useRef(0);

  // Default nodes configuration (20 nodes like original)
  const DEFAULT_NODES = useMemo(() =>
    Array.from({ length: 3 }, (_, i) => {
      const port = 5000 + i;
      return { url: `http://127.0.0.1:${port}`, name: `Node ${i + 1}`, port };
    }), []
  );

  useEffect(() => {
    setNodes(DEFAULT_NODES.map(node => ({ 
      ...node, 
      status: 'checking', 
      chain: [], 
      chainLength: 0,
      state: {}, 
      error: null,
      lastUpdated: null,
      peers: Math.floor(Math.random() * 8),
      hashRate: Math.floor(Math.random() * 1000) + 100,
      lastBlockTime: Date.now() - Math.floor(Math.random() * 300000)
    })));
    fetchAllNodesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval;
    if (isAutoRefresh) interval = setInterval(fetchAllNodesData, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Get best online node (longest chain)
  const bestOnlineNode = useMemo(() => {
    const online = nodes.filter(n => n.status === 'online');
    if (online.length === 0) return null;
    return online.reduce((a, b) => (a.chainLength >= b.chainLength ? a : b));
  }, [nodes]);

  // Best chain for Explorer
  const bestChain = useMemo(() => bestOnlineNode?.chain || [], [bestOnlineNode]);

  // Flow events helper
  const pushEvent = (e) => {
    setEvents(prev => [{ id: `${Date.now()}-${Math.random()}`, ts: new Date(), ...e }, ...prev].slice(0, 200));
  };

  // Detect new blocks
  useEffect(() => {
    const currentHeight = bestOnlineNode?.chainLength || 0;
    if (currentHeight > prevBestHeightRef.current) {
      const newBlocksCount = currentHeight - prevBestHeightRef.current;
      for (let i = 0; i < Math.min(newBlocksCount, 3); i++) {
        pushEvent({ 
          type: 'block', 
          level: 'success', 
          message: `New block mined on ${bestOnlineNode?.name}`, 
          meta: { height: currentHeight - i } 
        });
      }
      prevBestHeightRef.current = currentHeight;
    }
  }, [bestOnlineNode]);

  const fetchAllNodesData = async () => {
    setLoading(true);
    const updatedNodes = await Promise.all(
      DEFAULT_NODES.map(async (node) => {
        try {
          // Add timeout to fetch requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const [chainResponse, stateResponse, statsResponse] = await Promise.all([
            fetch(`${node.url}/chain`, { 
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            }),
            fetch(`${node.url}/state`, { 
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            }),
            fetch(`${node.url}/stats`, { 
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            }).catch(() => null) // Stats is optional
          ]);

          clearTimeout(timeoutId);

          if (chainResponse.ok && stateResponse.ok) {
            const chainData = await chainResponse.json();
            const stateData = await stateResponse.json();
            const statsData = statsResponse?.ok ? await statsResponse.json() : {};

            return {
              ...node,
              status: 'online',
              chain: chainData.chain || [],
              chainLength: chainData.length || (chainData.chain?.length || 0),
              state: stateData.state || {},
              error: null,
              lastUpdated: new Date(),
              peers: statsData.network_info?.connected_peers || Math.floor(Math.random() * 8) + 2,
              hashRate: statsData.total_transactions || Math.floor(Math.random() * 1000) + 100,
              lastBlockTime: statsData.last_block_time ? 
                new Date(statsData.last_block_time * 1000).getTime() : 
                Date.now() - Math.floor(Math.random() * 300000),
              difficulty: chainData.current_difficulty || 4,
              totalTransactions: statsData.total_transactions || 0,
              pendingTransactions: statsData.pending_transactions || 0
            };
          }
          throw new Error(`HTTP ${chainResponse.status}`);
        } catch (error) {
          return {
            ...node,
            status: error.name === 'AbortError' ? 'timeout' : 'offline',
            chain: [],
            chainLength: 0,
            state: {},
            error: error?.message || 'Unavailable',
            lastUpdated: new Date(),
            peers: 0,
            hashRate: 0,
            lastBlockTime: null,
            difficulty: 4,
            totalTransactions: 0,
            pendingTransactions: 0
          };
        }
      })
    );

    setNodes(updatedNodes);
    calculateNetworkStats(updatedNodes);
    setLoading(false);

    // Fetch advanced data
    setTimeout(() => {
      if (bestOnlineNode) {
        fetchMempool(bestOnlineNode.url);
        fetchTopology(bestOnlineNode.url);
      }
    }, 0);
  };

  const calculateNetworkStats = (nodeList) => {
    const onlineNodes = nodeList.filter(node => node.status === 'online');
    const totalBlocks = Math.max(0, ...onlineNodes.map(node => node.chainLength));
    const totalTransactions = onlineNodes.reduce((sum, node) => {
      return sum + node.chain.reduce((blockSum, block) => blockSum + (block.transactions?.length || 0), 0);
    }, 0);

    // Merge states
    const merged = {};
    onlineNodes.forEach(node => {
      Object.entries(node.state).forEach(([addr, bal]) => {
        const existing = merged[addr];
        if (!existing || node.chainLength >= existing.chainLength) {
          merged[addr] = { balance: bal, chainLength: node.chainLength };
        }
      });
    });
    const balances = {};
    Object.keys(merged).forEach(a => (balances[a] = merged[a].balance));
    setGlobalState(balances);

    const healthPercentage = (onlineNodes.length / nodeList.length) * 100;
    const networkHealth = healthPercentage >= 80 ? 'Healthy' : healthPercentage >= 50 ? 'Degraded' : 'Critical';
    const totalHashRate = onlineNodes.reduce((sum, node) => sum + node.hashRate, 0);

    setNetworkStats({
      totalNodes: onlineNodes.length,
      totalBlocks,
      totalTransactions,
      networkHealth,
      healthPercentage,
      hashRate: totalHashRate,
      difficulty: 4
    });
  };

  const fetchMempool = async (nodeUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const res = await fetch(`${nodeUrl}/mempool`, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.log('Mempool endpoint not available, using fallback');
        setMempool([]);
        return;
      }
      
      const data = await res.json();
      const txs = data.txs || [];

      // Detect changes for events
      const prev = prevMempoolRef.current;
      const next = new Set(txs.map(t => t.txid || JSON.stringify(t)));
      
      txs.forEach(t => {
        const id = t.txid || JSON.stringify(t);
        if (!prev.has(id)) {
          pushEvent({ 
            type: 'tx', 
            level: 'info', 
            message: `New transaction: ${t.from || t.sender} → ${t.to || t.recipient}`, 
            meta: { id: id.slice(0, 8), amount: t.amount } 
          });
        }
      });

      // Detect removed transactions (mined)
      prev.forEach(oldId => {
        if (!next.has(oldId)) {
          pushEvent({
            type: 'tx',
            level: 'success',
            message: 'Transaction mined',
            meta: { id: oldId.slice(0, 8) }
          });
        }
      });

      prevMempoolRef.current = next;
      setMempool(txs);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.log('Mempool fetch failed:', error.message);
      }
      setMempool([]);
    }
  };

  const fetchTopology = async (nodeUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const res = await fetch(`${nodeUrl}/topology`, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (Array.isArray(data.nodes)) {
        setTopology({ 
          nodes: data.nodes, 
          edges: data.edges || [] 
        });
        return;
      }
      throw new Error('Invalid topology format');
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.log('Topology fetch failed, using fallback:', error.message);
      }
      
      // Fallback: derive topology from online nodes
      const online = nodes.filter(n => n.status === 'online');
      const center = online[0];
      
      const derivedNodes = online.map((n, i) => ({ 
        id: n.port.toString(), 
        url: n.url, 
        status: n.status, 
        label: n.name, 
        index: i 
      }));
      
      const derivedEdges = center ? 
        online.slice(1).map(n => ({ from: center.port.toString(), to: n.port.toString() })) : 
        [];
        
      setTopology({ nodes: derivedNodes, edges: derivedEdges });
    }
  };

  const mineBlock = async (nodeUrl) => {
    try {
      setLoading(true);
      const res = await fetch(`${nodeUrl}/mine`);
      if (res.ok) {
        pushEvent({ type: 'block', level: 'success', message: 'Block mining successful', meta: {} });
        await fetchAllNodesData();
      }
    } catch (e) {
      console.error('Mining failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const resolveConsensus = async (nodeUrl) => {
    try {
      setLoading(true);
      
      // First, try to trigger P2P consensus (this is what your blockchain actually uses)
      const p2pResponse = await fetch(`${nodeUrl}/network/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (p2pResponse.ok) {
        console.log('P2P sync initiated successfully');
        // Wait a bit for P2P sync to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchAllNodesData();
        return;
      }
      
      // Fallback to legacy HTTP consensus if P2P sync endpoint doesn't exist
      console.log('P2P sync not available, trying legacy HTTP consensus...');
      const legacyResponse = await fetch(`${nodeUrl}/nodes/resolve`);
      
      if (legacyResponse.ok) {
        console.log('Legacy HTTP consensus completed');
        await fetchAllNodesData();
      } else {
        console.error('Both P2P and legacy sync failed');
      }
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Try manual chain sync as last resort
      try {
        console.log('Attempting manual chain sync...');
        await fetch(`${nodeUrl}/chain/sync`, { method: 'POST' });
        await fetchAllNodesData();
      } catch (manualError) {
        console.error('Manual sync also failed:', manualError);
      }
    } finally {
      setLoading(false);
    }
  };
  const triggerP2PSync = async (nodeUrl) => {
    try {
      setLoading(true);
      
      // This calls the P2P consensus that your blockchain actually uses
      const response = await fetch(`${nodeUrl}/p2p/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log('P2P consensus triggered successfully');
        // Wait for P2P sync to propagate
        await new Promise(resolve => setTimeout(resolve, 3000));
        await fetchAllNodesData();
      } else {
        throw new Error(`P2P sync failed with status: ${response.status}`);
      }
      
    } catch (error) {
      console.error('P2P sync error:', error);
      // Fallback to regular refresh
      await fetchAllNodesData();
    } finally {
      setLoading(false);
    }
  };
  const submitTransaction = async () => {
    if (!newTransaction.sender || !newTransaction.recipient || !newTransaction.amount) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const nodeUrl = nodes.find(n => n.status === 'online')?.url || DEFAULT_NODES[0].url;
      
      const response = await fetch(`${nodeUrl}/transactions/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: newTransaction.sender,
          recipient: newTransaction.recipient,
          amount: parseFloat(newTransaction.amount)
        })
      });

      if (response.ok) {
        setNewTransaction({ sender: '', recipient: '', amount: '' });
        setShowTransactionForm(false);
        pushEvent({ type: 'tx', level: 'info', message: 'Transaction submitted', meta: {} });
        await fetchAllNodesData();
      } else {
        const msg = await response.text();
        alert(`Transaction failed: ${msg}`);
      }
    } catch (error) {
      alert(`Transaction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Style utilities
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#00ff88';
      case 'offline': return '#ff4444';
      case 'checking': return '#ffaa00';
      default: return '#666666';
    }
  };

  const getHealthColor = (health) => {
    switch (health) {
      case 'Healthy': return '#00ff88';
      case 'Degraded': return '#ffaa00';
      case 'Critical': return '#ff4444';
      default: return '#666666';
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '--';
    if (typeof ts === 'number') return new Date(ts * 1000).toLocaleString();
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  };

  const shortHash = (h='') => h ? `${h.slice(0,8)}...${h.slice(-8)}` : 'N/A';

  // Explorer filtered list
  const explorerList = useMemo(() => {
    let list = bestChain.slice().sort((a, b) => (b.index || b.height || 0) - (a.index || a.height || 0));
    if (blockSearch.trim()) {
      const q = blockSearch.trim().toLowerCase();
      list = list.filter(b =>
        String(b.index ?? b.height ?? '').toLowerCase().includes(q) ||
        (b.hash || '').toLowerCase().includes(q) ||
        (b.previous_hash || b.prev_hash || '').toLowerCase().includes(q)
      );
    }
    return list.slice(0, 50);
  }, [bestChain, blockSearch]);

  // Radial layout for topology
  const radialLayout = (w, h, nodes) => {
    const R = Math.min(w, h) / 2 - 40;
    const cx = w / 2, cy = h / 2;
    if (nodes.length === 0) return [];
    return nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const x = cx + R * Math.cos(angle);
      const y = cy + R * Math.sin(angle);
      return { ...n, x, y };
    });
  };

  // Styles
  const containerStyle = {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
    color: '#ffffff',
    fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
    padding: '20px',
    boxSizing: 'border-box'
  };

  const glassStyle = {
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  };

  const buttonStyle = {
    background: 'linear-gradient(135deg, #ff4444, #cc0000)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    padding: '10px 20px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(255, 68, 68, 0.3)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  };

  const greenButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #00ff88, #00cc66)',
    boxShadow: '0 4px 15px rgba(0, 255, 136, 0.3)'
  };

  const neutralButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #333, #555)',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
  };

  const navBtn = (active) => ({
    ...buttonStyle,
    padding: '8px 12px',
    background: active ? 'linear-gradient(135deg, #ff4444, #cc0000)' : 'linear-gradient(135deg, #333, #555)',
    boxShadow: active ? '0 4px 15px rgba(255, 68, 68, 0.3)' : '0 4px 15px rgba(0, 0, 0, 0.3)'
  });

  const inputStyle = {
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'white',
    fontFamily: 'inherit',
    outline: 'none'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ ...glassStyle, padding: '30px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ 
              fontSize: '2.5rem', 
              fontWeight: '700', 
              margin: '0 0 10px 0',
              background: 'linear-gradient(135deg, #ff4444, #00ff88)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px'
            }}>
              Anbessa Blockchain
            </h1>
            <p style={{ color: '#888', margin: '0', fontSize: '1rem', letterSpacing: '1px' }}>
              NEURAL NETWORK CONSENSUS ENGINE
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              style={{
                ...buttonStyle,
                background: isAutoRefresh ? 'linear-gradient(135deg, #00ff88, #00cc66)' : 'linear-gradient(135deg, #333, #555)',
                boxShadow: isAutoRefresh ? '0 4px 15px rgba(0, 255, 136, 0.3)' : '0 4px 15px rgba(0, 0, 0, 0.3)'
              }}
            >
              <Activity size={16} style={{ animation: isAutoRefresh ? 'pulse 2s infinite' : 'none' }} />
              NEURAL SYNC {isAutoRefresh ? 'ON' : 'OFF'}
            </button>
            <button onClick={fetchAllNodesData} disabled={loading} style={greenButtonStyle}>
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              REFRESH
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={navBtn(activeView==='overview')} onClick={() => setActiveView('overview')}>
            <Layers size={14}/> Overview
          </button>
          <button style={navBtn(activeView==='explorer')} onClick={() => setActiveView('explorer')}>
            <List size={14}/> Explorer
          </button>
          <button style={navBtn(activeView==='mempool')} onClick={() => setActiveView('mempool')}>
            <Radio size={14}/> Mempool
          </button>
          <button style={navBtn(activeView==='topology')} onClick={() => setActiveView('topology')}>
            <Map size={14}/> Topology
          </button>
          <button style={navBtn(activeView==='flow')} onClick={() => setActiveView('flow')}>
            <Zap size={14}/> Flow
          </button>
        </div>
      </div>

      {/* Conditional Views */}
      {activeView === 'overview' && (
        <>
          {/* Enhanced Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ 
              ...glassStyle, 
              padding: '25px',
              background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.1), rgba(255, 68, 68, 0.05))',
              borderColor: 'rgba(255, 68, 68, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#ff4444', marginBottom: '8px', letterSpacing: '1px' }}>ACTIVE NODES</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0', color: '#ff4444' }}>{networkStats.totalNodes}</p>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0' }}>/{DEFAULT_NODES.length} DEPLOYED</p>
                </div>
                <Server size={32} style={{ color: '#ff4444', opacity: 0.8 }} />
              </div>
            </div>

            <div style={{ 
              ...glassStyle, 
              padding: '25px',
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 136, 0.05))',
              borderColor: 'rgba(0, 255, 136, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#00ff88', marginBottom: '8px', letterSpacing: '1px' }}>CHAIN HEIGHT</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0', color: '#00ff88' }}>{networkStats.totalBlocks}</p>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> SYNCED
                  </p>
                </div>
                <Hash size={32} style={{ color: '#00ff88', opacity: 0.8 }} />
              </div>
            </div>

            <div style={{ 
              ...glassStyle, 
              padding: '25px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
              borderColor: 'rgba(255, 255, 255, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#ffffff', marginBottom: '8px', letterSpacing: '1px' }}>HASH RATE</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0', color: '#ffffff' }}>{networkStats.hashRate}</p>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0' }}>H/s NETWORK</p>
                </div>
                <Cpu size={32} style={{ color: '#ffffff', opacity: 0.8 }} />
              </div>
            </div>

            <div style={{ 
              ...glassStyle, 
              padding: '25px',
              background: `linear-gradient(135deg, ${getHealthColor(networkStats.networkHealth) === '#00ff88' ? 'rgba(0, 255, 136, 0.1)' : getHealthColor(networkStats.networkHealth) === '#ffaa00' ? 'rgba(255, 170, 0, 0.1)' : 'rgba(255, 68, 68, 0.1)'}, ${getHealthColor(networkStats.networkHealth) === '#00ff88' ? 'rgba(0, 255, 136, 0.05)' : getHealthColor(networkStats.networkHealth) === '#ffaa00' ? 'rgba(255, 170, 0, 0.05)' : 'rgba(255, 68, 68, 0.05)'})`,
              borderColor: getHealthColor(networkStats.networkHealth) === '#00ff88' ? 'rgba(0, 255, 136, 0.3)' : getHealthColor(networkStats.networkHealth) === '#ffaa00' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 68, 68, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: getHealthColor(networkStats.networkHealth), marginBottom: '8px', letterSpacing: '1px' }}>NETWORK STATUS</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '700', margin: '0', color: getHealthColor(networkStats.networkHealth) }}>{networkStats.networkHealth}</p>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0' }}>{networkStats.healthPercentage?.toFixed(0)}% OPERATIONAL</p>
                </div>
                {networkStats.networkHealth === 'Healthy' ? 
                  <CheckCircle size={32} style={{ color: getHealthColor(networkStats.networkHealth), opacity: 0.8 }} /> : 
                  <AlertCircle size={32} style={{ color: getHealthColor(networkStats.networkHealth), opacity: 0.8 }} />
                }
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ ...glassStyle, padding: '25px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', letterSpacing: '1px', color: '#ff4444' }}>⟨ NEURAL CONTROLS ⟩</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setShowTransactionForm(!showTransactionForm)} style={buttonStyle}>
                <Plus size={16} />
                NEW TX
              </button>
              <button
                onClick={() => nodes.forEach(node => node.status === 'online' && mineBlock(node.url))}
                disabled={loading}
                style={greenButtonStyle}
              >
                <Zap size={16} />
                MINE ALL
              </button>
              <button
                onClick={() => nodes.forEach(node => node.status === 'online' && resolveConsensus(node.url))}
                disabled={loading}
                style={neutralButtonStyle}
              >
                <Users size={16} />
                SYNC ALL
              </button>
            </div>

            {showTransactionForm && (
              <div style={{ 
                marginTop: '20px', 
                padding: '20px', 
                background: 'rgba(255, 68, 68, 0.1)', 
                borderRadius: '10px',
                border: '1px solid rgba(255, 68, 68, 0.3)'
              }}>
                <h4 style={{ color: '#ff4444', marginBottom: '15px', letterSpacing: '1px' }}>⟨ NEURAL TRANSFER ⟩</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="SENDER NODE ID"
                    value={newTransaction.sender}
                    onChange={(e) => setNewTransaction({...newTransaction, sender: e.target.value})}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="TARGET NODE ID"
                    value={newTransaction.recipient}
                    onChange={(e) => setNewTransaction({...newTransaction, recipient: e.target.value})}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="AMOUNT"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={submitTransaction} disabled={loading} style={greenButtonStyle}>
                    <Send size={16} />
                    EXECUTE
                  </button>
                  <button onClick={() => setShowTransactionForm(false)} style={neutralButtonStyle}>
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Global State */}
          {Object.keys(globalState).length > 0 && (
            <div style={{ ...glassStyle, padding: '25px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', letterSpacing: '1px', color: '#ffffff' }}>
                ⟨ GLOBAL STATE MATRIX ⟩
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {Object.entries(globalState).map(([address, balance]) => (
                  <div key={address} style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#888', 
                          marginBottom: '5px',
                          fontWeight: '600',
                          letterSpacing: '1px' 
                        }}>
                          ACCOUNT
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px'
                        }}>
                          {address.length > 15 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#888', 
                          marginBottom: '5px',
                          fontWeight: '600',
                          letterSpacing: '1px' 
                        }}>
                          BALANCE
                        </div>
                        <div style={{ 
                          fontSize: '18px', 
                          fontWeight: '700', 
                          color: '#00ff88' 
                        }}>
                          {typeof balance === 'number' ? balance.toLocaleString() : balance}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: '15px', 
                fontSize: '12px', 
                color: '#666', 
                textAlign: 'center' 
              }}>
                Total Accounts: {Object.keys(globalState).length} • 
                Total Supply: {Object.values(globalState).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0).toLocaleString()}
              </div>
            </div>
          )}

          {/* Enhanced Nodes Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {nodes.map((node) => (
              <div key={node.port} style={{
                ...glassStyle,
                background: node.status === 'online' 
                  ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 136, 0.05))' 
                  : 'linear-gradient(135deg, rgba(255, 68, 68, 0.1), rgba(255, 68, 68, 0.05))',
                borderColor: node.status === 'online' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)'
              }}>
                {/* Node Header */}
                <div style={{ 
                  background: node.status === 'online' 
                    ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 255, 136, 0.1))' 
                    : 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.1))',
                  padding: '20px',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0', letterSpacing: '1px' }}>
                      ⟨ {node.name.toUpperCase()} ⟩
                    </h3>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: node.status === 'online' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 68, 0.2)',
                      border: `1px solid ${node.status === 'online' ? '#00ff88' : '#ff4444'}`,
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '1px'
                    }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getStatusColor(node.status),
                        marginRight: '6px'
                      }} />
                      {node.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', marginBottom: '4px' }}>PORT</div>
                      <div style={{ color: '#fff', fontWeight: '700' }}>{node.port}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', marginBottom: '4px' }}>CHAIN</div>
                      <div style={{ color: '#fff', fontWeight: '700' }}>{node.chainLength || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', marginBottom: '4px' }}>PEERS</div>
                      <div style={{ color: '#fff', fontWeight: '700' }}>{node.peers || 0}</div>
                    </div>
                  </div>
                </div>

                {node.status === 'online' ? (
                  <div style={{ padding: '20px' }}>
                    {/* Node Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <button onClick={() => mineBlock(node.url)} disabled={loading} style={{
                        ...buttonStyle,
                        fontSize: '12px',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #00ff88, #00cc66)'
                      }}>
                        <Coins size={14} />
                        MINE
                      </button>
                      <button onClick={() => resolveConsensus(node.url)} disabled={loading} style={{
                        ...buttonStyle,
                        fontSize: '12px',
                        padding: '8px 12px'
                      }}>
                        <Users size={14} />
                        SYNC
                      </button>
                      <button
                        onClick={() => setSelectedNode(selectedNode?.port === node.port ? null : node)}
                        style={{
                          ...buttonStyle,
                          fontSize: '12px',
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #333, #555)'
                        }}
                      >
                        <Eye size={14} />
                        {selectedNode?.port === node.port ? 'HIDE' : 'DETAILS'}
                      </button>
                    </div>

                    {/* Account Balances */}
                    {Object.keys(node.state).length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '10px', letterSpacing: '1px' }}>
                          ⟨ ACCOUNT BALANCES ⟩
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(node.state).slice(0, 3).map(([addr, bal]) => (
                            <div key={addr} style={{
                              padding: '10px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  color: '#888',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '70%'
                                }}>
                                  {addr}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#00ff88' }}>{bal}</span>
                              </div>
                            </div>
                          ))}
                          {Object.keys(node.state).length > 3 && (
                            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', padding: '4px' }}>
                              +{Object.keys(node.state).length - 3} more accounts
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recent Blocks */}
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '10px', letterSpacing: '1px' }}>
                        ⟨ RECENT BLOCKS ⟩
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                        {node.chain.slice(-3).reverse().map((block, idx) => (
                          <div key={idx} style={{
                            padding: '12px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <strong style={{ color: '#00ff88' }}>BLOCK #{block.index ?? block.height}</strong>
                              <span style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> {formatTimestamp(block.timestamp)}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                              <div><span style={{ color: '#fff', fontWeight: '600' }}>Hash:</span> {shortHash(block.previous_hash || block.prev_hash)}</div>
                              <div><span style={{ color: '#fff', fontWeight: '600' }}>Proof:</span> {block.proof ?? block.nonce}</div>
                            </div>
                            {block.transactions && block.transactions.length > 0 && (
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '11px', color: '#fff', marginBottom: '6px' }}>TRANSACTIONS</div>
                                {block.transactions.slice(0, 2).map((tx, tIdx) => (
                                  <div key={tIdx} style={{
                                    padding: '8px',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    borderRadius: '4px',
                                    marginBottom: '4px'
                                  }}>
                                    {tx.sender === '0' ? (
                                      <span style={{ color: '#00ff88', fontWeight: '600', fontSize: '11px' }}>
                                        ⚡ REWARD: {tx.amount} → {tx.recipient}
                                      </span>
                                    ) : typeof tx === 'object' && tx.sender ? (
                                      <span style={{ color: '#fff', fontSize: '11px' }}>
                                        💸 {tx.sender} → {tx.recipient}: <strong style={{ color: '#00ff88' }}>{tx.amount}</strong>
                                      </span>
                                    ) : (
                                      <span style={{ color: '#888', fontSize: '11px' }}>
                                        Genesis: {JSON.stringify(tx)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {block.transactions.length > 2 && (
                                  <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>
                                    +{block.transactions.length - 2} more transactions
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Details */}
                    {selectedNode?.port === node.port && (
                      <div style={{ marginTop: '20px', ...glassStyle, padding: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#ff4444', letterSpacing: '1px' }}>⟨ COMPLETE CHAIN DATA ⟩</h4>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '6px', padding: '10px' }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                            {JSON.stringify(node.chain, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', padding: '20px', borderRadius: '50%', background: 'rgba(255, 68, 68, 0.1)', marginBottom: '15px' }}>
                      <AlertCircle size={32} style={{ color: '#ff4444' }} />
                    </div>
                    <div style={{ fontWeight: '700', color: '#ff4444', marginBottom: '5px' }}>NODE OFFLINE</div>
                    <div style={{ fontSize: '13px', color: '#888' }}>Unable to establish connection</div>
                    {node.error && (
                      <div style={{ marginTop: '10px', padding: '8px', borderRadius: '6px', background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', fontSize: '11px' }}>
                        {node.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Explorer View */}
      {activeView === 'explorer' && (
        <div style={{ ...glassStyle, padding: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <Search size={18} style={{ color: '#00ff88' }} />
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Search by height/hash/prev_hash"
              value={blockSearch}
              onChange={e => setBlockSearch(e.target.value)}
            />
            <div style={{
              padding: '8px 12px',
              background: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#00ff88'
            }}>
              BEST NODE: {bestOnlineNode ? bestOnlineNode.name : '—'}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#00ff88' }}>HEIGHT</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#00ff88' }}>HASH</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#00ff88' }}>TXS</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#00ff88' }}>TIME</th>
                </tr>
              </thead>
              <tbody>
                {explorerList.map((b, i) => (
                  <tr key={(b.hash || '') + i} 
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }} 
                      onClick={() => { setSelectedBlock(b); setSelectedTx(null); }}
                      onMouseEnter={(e) => e.target.closest('tr').style.background = 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={(e) => e.target.closest('tr').style.background = 'transparent'}>
                    <td style={{ padding: '12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>{b.index ?? b.height}</td>
                    <td style={{ padding: '12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#00ff88', fontFamily: 'monospace' }}>{shortHash(b.hash)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>{b.transactions?.length || 0}</td>
                    <td style={{ padding: '12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>{formatTimestamp(b.timestamp)}</td>
                  </tr>
                ))}
                {explorerList.length === 0 && (
                  <tr><td colSpan="4" style={{ padding: '20px', color: '#666', textAlign: 'center' }}>No blocks to display.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Block/Tx Details Drawer */}
          {(selectedBlock || selectedTx) && (
            <div style={{
              position: 'fixed', right: '20px', top: '20px', bottom: '20px', width: 'min(520px, 90vw)',
              background: 'rgba(0, 0, 0, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '12px', padding: '20px', zIndex: 9999, backdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#ff4444', letterSpacing: '1px' }}>
                  ⟨ {selectedTx ? 'TRANSACTION' : 'BLOCK'} DETAILS ⟩
                </h3>
                <button style={buttonStyle} onClick={() => { setSelectedBlock(null); setSelectedTx(null); }}>CLOSE</button>
              </div>
              {!selectedTx && selectedBlock && (
                <div style={{ overflowY: 'auto', height: 'calc(100% - 60px)' }}>
                  <div style={{ ...glassStyle, padding: '15px', marginBottom: '15px' }}>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Height:</strong> {selectedBlock.index ?? selectedBlock.height}</div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Hash:</strong> <span style={{ color: '#fff', fontFamily: 'monospace' }}>{selectedBlock.hash || '—'}</span></div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Prev:</strong> <span style={{ fontFamily: 'monospace' }}>{shortHash(selectedBlock.previous_hash || selectedBlock.prev_hash)}</span></div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Time:</strong> {formatTimestamp(selectedBlock.timestamp)}</div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Merkle:</strong> <span style={{ fontFamily: 'monospace' }}>{shortHash(selectedBlock.merkle || '')}</span></div>
                    <div><strong style={{ color: '#00ff88' }}>Nonce/Proof:</strong> {selectedBlock.proof ?? selectedBlock.nonce}</div>
                  </div>
                  <div>
                    <h4 style={{ margin: '15px 0 10px', color: '#fff', letterSpacing: '1px' }}>⟨ TRANSACTIONS ⟩</h4>
                    {(selectedBlock.transactions || []).map((tx, i) => (
                      <div key={i} style={{ ...glassStyle, padding: '12px', marginBottom: '10px', cursor: 'pointer' }}
                        onClick={() => setSelectedTx(tx)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#fff', fontSize: '12px' }}>#{i+1}</span>
                          <span style={{ fontFamily: 'monospace', color: '#00ff88' }}>{(tx.txid && shortHash(tx.txid)) || '—'}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                          {tx.sender === '0' ?
                            <span style={{ color: '#00ff88', fontWeight: '600' }}>Reward {tx.amount} → {tx.recipient}</span> :
                            <span>{tx.sender} → {tx.recipient} : <strong style={{ color: '#fff' }}>{tx.amount}</strong> (fee {tx.fee ?? 0})</span>
                          }
                        </div>
                      </div>
                    ))}
                    {(selectedBlock.transactions || []).length === 0 && (
                      <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No transactions.</div>
                    )}
                  </div>
                </div>
              )}
              {selectedTx && (
                <div style={{ overflowY: 'auto', height: 'calc(100% - 60px)' }}>
                  <div style={{ ...glassStyle, padding: '15px', marginBottom: '15px' }}>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>TxID:</strong> <span style={{ fontFamily: 'monospace', color: '#fff' }}>{selectedTx.txid || '—'}</span></div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Type:</strong> {selectedTx.type || (selectedTx.sender === '0' ? 'coinbase' : 'transfer')}</div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>From:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedTx.sender || '—'}</span></div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>To:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedTx.recipient || '—'}</span></div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Amount:</strong> {selectedTx.amount}</div>
                    <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Fee:</strong> {selectedTx.fee ?? 0}</div>
                    {selectedTx.unlock_time && <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Unlock Time:</strong> {formatTimestamp(selectedTx.unlock_time)}</div>}
                    {selectedTx.required_signers && <div style={{ marginBottom: '8px' }}><strong style={{ color: '#00ff88' }}>Required Signers:</strong> {Array.isArray(selectedTx.required_signers) ? selectedTx.required_signers.length : selectedTx.required_signers}</div>}
                    {selectedTx.contract && (
                      <div><strong style={{ color: '#00ff88' }}>Contract:</strong><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: '#888', marginTop: '8px' }}>{JSON.stringify(selectedTx.contract, null, 2)}</pre></div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={neutralButtonStyle} onClick={() => setSelectedTx(null)}>BACK TO BLOCK</button>
                    <button style={buttonStyle} onClick={() => { setSelectedBlock(null); setSelectedTx(null); }}>CLOSE</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


{/* ===== Mempool View ===== */}
      {activeView === 'mempool' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <div style={{ 
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            padding: 18 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Live Mempool</h3>
              <div style={badge('rgba(255,255,255,0.06)', COLORS.white)}>
                Size: <strong style={{ marginLeft: 6 }}>{mempool.length}</strong>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>TxID</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>From</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>To</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Fee</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${COLORS.border}` }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mempool.map((t, i) => (
                    <tr key={(t.txid || JSON.stringify(t)) + i} className="rowPulse">
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, fontFamily: 'monospace', color: COLORS.green }}>{shortHash(t.txid || '')}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, fontFamily: 'monospace' }}>{(t.from || t.sender || '').slice(0,12)}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}`, fontFamily: 'monospace' }}>{(t.to || t.recipient || '').slice(0,12)}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}` }}>{t.amount}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}` }}>{t.fee ?? 0}</td>
                      <td style={{ padding: '10px 6px', borderBottom: `1px solid ${COLORS.border}` }}>{t.type || (t.sender === '0' ? 'coinbase' : 'transfer')}</td>
                    </tr>
                  ))}
                  {mempool.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: 16, color: COLORS.textMuted }}>
                      No mempool data. Ensure your node exposes <code style={{ color: COLORS.green }}>/mempool</code> or rely on polling after submitting transactions.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ 
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            padding: 18 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Radio size={16}/><div style={{ color: COLORS.textDim, fontSize: 13 }}>Listening for events via WebSocket (if available). Otherwise, the dashboard polls every refresh.</div>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              New mempool arrivals briefly glow; removals log into the Flow timeline.
            </div>
          </div>
        </div>
      )}

      {/* ===== Topology View ===== */}
      {activeView === 'topology' && (
        <div style={{ 
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          padding: 18 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Network Topology</h3>
            {/* <div style={badge('rgba(255,255,255,0.06)', COLORS.white)}>
              {topologyError ? 'Derived' : 'Reported'} • {topology.nodes.length} nodes
            </div> */}
          </div>
          <div style={{ position: 'relative', height: 460, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            <svg width="100%" height="100%" viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid meet">
              {/* Edges */}
              {(() => {
                const laid = radialLayout(1000, 460, topology.nodes);
                const indexById = Object.fromEntries(laid.map((n, i) => [n.id, i]));
                return topology.edges.map((e, i) => {
                  const a = laid[indexById[e.from]] || laid[0];
                  const b = laid[indexById[e.to]] || laid[1];
                  if (!a || !b) return null;
                  return (
                    <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={COLORS.textMuted} strokeWidth="1.5" strokeOpacity="0.5" />
                  );
                });
              })()}
              {/* Nodes */}
              {(() => {
                const laid = radialLayout(1000, 460, topology.nodes);
                return laid.map((n, i) => (
                  <g key={n.id || i}>
                    <circle cx={n.x} cy={n.y} r="16"
                      fill={n.status === 'online' ? COLORS.green : n.status === 'offline' ? COLORS.red : COLORS.white}
                      stroke={COLORS.border} strokeWidth="1" />
                    <text x={n.x + 22} y={n.y + 5} fontSize="12" fill={COLORS.white} style={{ fontFamily: 'monospace' }}>
                      {(n.label || n.url || n.id).toString().slice(0, 18)}
                    </text>
                  </g>
                ));
              })()}
            </svg>
          </div>
          <div style={{ marginTop: 8, color: COLORS.textMuted, fontSize: 12 }}>
            If your backend exposes <code style={{ color: COLORS.green }}>/topology</code>, edges reflect real peer links; otherwise, we infer a star-like layout.
          </div>
        </div>
      )}

      {/* ===== Flow View ===== */}
      {activeView === 'flow' && (
        <div style={{ 
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          padding: 18 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Live Event Timeline</h3>
            <div style={badge('rgba(255,255,255,0.06)', COLORS.white)}>Newest first</div>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(e => (
              <div key={e.id} className={`neonCard ${e.type}`} style={{ 
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                padding: 12 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, color:
                      e.level === 'success' ? COLORS.green :
                      e.level === 'error' ? COLORS.red : COLORS.white
                    }}>
                      {e.type === 'block' ? 'Block' : e.type === 'tx' ? 'Transaction' : 'System'}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{e.message}</div>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{e.ts.toLocaleTimeString()}</div>
                </div>
                {e.meta && Object.keys(e.meta).length > 0 && (
                  <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 11, color: COLORS.textDim }}>
                    {JSON.stringify(e.meta, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <div style={{ color: COLORS.textMuted }}>No events yet. Submit a transaction or mine a block to see activity.</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(0,255,136,0.3);} 70% { box-shadow: 0 0 0 8px rgba(0,255,136,0); } 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0); } }
        .rowPulse td { animation: pulse 1.2s ease-out; }
        .neonCard.block { border-left: 4px solid #00ff88; }
        .neonCard.tx { border-left: 4px solid #ffffff; }
        .neonCard.system { border-left: 4px solid #ff4444; }
      `}</style>
    </div>
  );
};

export default FuturisticBlockchainDashboard;
