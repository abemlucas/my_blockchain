
import React, { useState, useEffect } from 'react';
import {
  Activity, Server, Coins, Users, Hash, Clock, AlertCircle, CheckCircle,
  RefreshCw, Plus, Send, Eye, TrendingUp
} from 'lucide-react';

/**
 * Futuristic Blockchain Dashboard (restricted palette: black, green, red, white)
 * Feature parity with App.jsx:
 * - Auto refresh + manual refresh
 * - Network stats: active nodes, total blocks, total tx, health
 * - Global actions: New Tx, Mine All, Sync All
 * - Per-node actions: Mine, Sync, Details toggle
 * - Per-node: header (status/port/chain length/last updated)
 * - Per-node: recent blocks + tx preview
 * - Per-node: account balances (top 3) + "+N more"
 * - Details pane: full chain JSON
 * - Global State balances
 * - Offline node card with error
 * Design constraints:
 * - Only black, green, red, white (grays derived from black/white via opacity are allowed)
 */

const FuturisticBlockchainDashboard = () => {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ sender: '', recipient: '', amount: '' });
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [globalState, setGlobalState] = useState({});
  const [networkStats, setNetworkStats] = useState({
    totalNodes: 0,
    totalBlocks: 0,
    totalTransactions: 0,
    networkHealth: 'Unknown',
    healthPercentage: 0
  });

  // Default nodes configuration (20 nodes like original App.jsx)
  const DEFAULT_NODES = Array.from({ length: 20 }, (_, i) => {
    const port = 5000 + i;
    return { url: `http://127.0.0.1:${port}`, name: `Node ${i + 1}`, port };
  });

  useEffect(() => {
    setNodes(DEFAULT_NODES.map(node => ({
      ...node, status: 'checking', chain: [], chainLength: 0, state: {}, error: null, lastUpdated: null
    })));
    fetchAllNodesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval;
    if (isAutoRefresh) interval = setInterval(fetchAllNodesData, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const fetchAllNodesData = async () => {
    setLoading(true);
    const updatedNodes = await Promise.all(
      DEFAULT_NODES.map(async (node) => {
        try {
          const [chainResponse, stateResponse] = await Promise.all([
            fetch(`${node.url}/chain`, { timeout: 5000 }),
            fetch(`${node.url}/state`, { timeout: 5000 })
          ]);

          if (chainResponse.ok && stateResponse.ok) {
            const chainData = await chainResponse.json();
            const stateData = await stateResponse.json();
            return {
              ...node,
              status: 'online',
              chain: chainData.chain || [],
              chainLength: chainData.length || 0,
              state: stateData.state || {},
              error: null,
              lastUpdated: new Date()
            };
          }
          throw new Error(`HTTP ${chainResponse.status}`);
        } catch (error) {
          return {
            ...node,
            status: 'offline',
            chain: [],
            chainLength: 0,
            state: {},
            error: error?.message || 'Unavailable',
            lastUpdated: new Date()
          };
        }
      })
    );

    setNodes(updatedNodes);
    calculateNetworkStats(updatedNodes);
    setLoading(false);
  };

  const calculateNetworkStats = (nodeList) => {
    const onlineNodes = nodeList.filter(n => n.status === 'online');
    const totalBlocks = Math.max(0, ...onlineNodes.map(n => n.chainLength));
    const totalTransactions = onlineNodes.reduce((sum, node) => {
      return sum + node.chain.reduce((bs, b) => bs + (b.transactions?.length || 0), 0);
    }, 0);

    // Merge states (prefer longer chains)
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

    const pct = (onlineNodes.length / nodeList.length) * 100;
    const health = pct >= 80 ? 'Healthy' : pct >= 50 ? 'Degraded' : 'Critical';

    setNetworkStats({
      totalNodes: onlineNodes.length,
      totalBlocks,
      totalTransactions,
      networkHealth: health,
      healthPercentage: pct
    });
  };

  const mineBlock = async (nodeUrl) => {
    try {
      setLoading(true);
      const res = await fetch(`${nodeUrl}/mine`);
      if (res.ok) await fetchAllNodesData();
    } catch (e) {
      console.error('Mine failed', e);
    } finally {
      setLoading(false);
    }
  };

  const resolveConsensus = async (nodeUrl) => {
    try {
      setLoading(true);
      const res = await fetch(`${nodeUrl}/nodes/resolve`);
      if (res.ok) await fetchAllNodesData();
    } catch (e) {
      console.error('Consensus failed', e);
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
        await fetchAllNodesData();
      } else {
        const msg = await response.text();
        alert(`Transaction failed: ${msg}`);
      }
    } catch (e) {
      alert(`Transaction failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== Styles (restricted palette) =====
  const COLORS = {
    bg: '#000000',
    panel: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    white: '#ffffff',
    green: '#00ff88',
    red: '#ff4444',
    textDim: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)'
  };

  const containerStyle = {
    minHeight: '100vh',
    width: '100%',
    background: COLORS.bg,
    color: COLORS.white,
    fontFamily: '"SF Mono","Monaco","Inconsolata","Roboto Mono",monospace',
    padding: 20,
    boxSizing: 'border-box'
  };

  const card = {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
  };

  const buttonBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'transform .15s ease, box-shadow .15s ease'
  };

  const btnGreen = {
    ...buttonBase,
    background: COLORS.green,
    color: '#000',
    boxShadow: '0 6px 18px rgba(0,255,136,0.25)'
  };
  const btnRed = {
    ...buttonBase,
    background: COLORS.red,
    color: '#fff',
    boxShadow: '0 6px 18px rgba(255,68,68,0.25)'
  };
  const btnNeutral = {
    ...buttonBase,
    background: 'rgba(255,255,255,0.08)',
    color: COLORS.white,
    border: `1px solid ${COLORS.border}`
  };

  const badge = (bg, fg) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1
  });

  const statusBadge = (status) => {
    if (status === 'online') return badge('rgba(0,255,136,0.15)', COLORS.green);
    if (status === 'offline') return badge('rgba(255,68,68,0.15)', COLORS.red);
    return badge('rgba(255,255,255,0.08)', COLORS.white);
  };

  const title = {
    fontSize: '2.2rem',
    fontWeight: 900,
    letterSpacing: 2,
    margin: 0,
    background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.green})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  };

  const subtle = { color: COLORS.textDim, fontSize: 13 };

  const nodeHeaderRow = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
  };

  const inputStyle = {
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    color: COLORS.white,
    fontFamily: 'inherit',
    outline: 'none'
  };

  const formatTimestamp = (ts) => new Date(ts * 1000).toLocaleString();
  const shortHash = (h='') => h ? `${h.slice(0,8)}...${h.slice(-8)}` : 'N/A';

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ ...card, padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h1 style={title}>⟨ NEON ⟩</h1>
            <div style={subtle}>Real‑time blockchain network monitor</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              style={isAutoRefresh ? btnGreen : btnNeutral}
              title="Toggle auto refresh"
            >
              <Activity size={16} /> AUTO {isAutoRefresh ? 'ON' : 'OFF'}
            </button>
            <button onClick={fetchAllNodesData} disabled={loading} style={btnGreen} title="Refresh now">
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> REFRESH
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...subtle, color: COLORS.red, fontWeight: 700 }}>ACTIVE NODES</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{networkStats.totalNodes}</div>
                <div style={subtle}>/{DEFAULT_NODES.length} total</div>
              </div>
              <Server />
            </div>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...subtle, color: COLORS.green, fontWeight: 700 }}>TOTAL BLOCKS</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{networkStats.totalBlocks}</div>
                <div style={subtle}><TrendingUp size={12}/> chain height</div>
              </div>
              <Hash />
            </div>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...subtle, color: COLORS.white, fontWeight: 700 }}>TRANSACTIONS</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{networkStats.totalTransactions}</div>
                <div style={subtle}>processed</div>
              </div>
              <Send />
            </div>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...subtle, color: COLORS.white, fontWeight: 700 }}>NETWORK HEALTH</div>
                <div style={{ fontSize: 24, fontWeight: 900, color:
                  networkStats.networkHealth === 'Healthy' ? COLORS.green :
                  networkStats.networkHealth === 'Degraded' ? COLORS.white : COLORS.red
                }}>{networkStats.networkHealth}</div>
                <div style={subtle}>{networkStats.healthPercentage?.toFixed(0)}% operational</div>
              </div>
              {networkStats.networkHealth === 'Healthy' ? <CheckCircle color={COLORS.green} /> : <AlertCircle color={COLORS.red} />}
            </div>
          </div>
        </div>
      </div>

      {/* Global Actions */}
      <div style={{ ...card, padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setShowTransactionForm(!showTransactionForm)} style={btnRed}>
            <Plus size={18}/> NEW TRANSACTION
          </button>
          <button
            onClick={() => nodes.forEach(n => n.status === 'online' && mineBlock(n.url))}
            disabled={loading}
            style={btnGreen}
          >
            <Coins size={18}/> MINE ALL
          </button>
          <button
            onClick={() => nodes.forEach(n => n.status === 'online' && resolveConsensus(n.url))}
            disabled={loading}
            style={btnNeutral}
          >
            <Users size={18}/> SYNC ALL
          </button>
        </div>

        {/* Transaction Form */}
        {showTransactionForm && (
          <div style={{ marginTop: 18, padding: 16, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Create New Transaction</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
              <input
                style={inputStyle} placeholder="Sender address"
                value={newTransaction.sender}
                onChange={e => setNewTransaction({ ...newTransaction, sender: e.target.value })}
              />
              <input
                style={inputStyle} placeholder="Recipient address"
                value={newTransaction.recipient}
                onChange={e => setNewTransaction({ ...newTransaction, recipient: e.target.value })}
              />
              <input
                type="number" style={inputStyle} placeholder="Amount"
                value={newTransaction.amount}
                onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submitTransaction} disabled={loading} style={btnGreen}>
                <Send size={16}/> Submit
              </button>
              <button onClick={() => setShowTransactionForm(false)} style={btnNeutral}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Global State */}
      {Object.keys(globalState).length > 0 && (
        <div style={{ ...card, padding: 22, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Global Account Balances</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 12 }}>
            {Object.entries(globalState).map(([address, balance]) => (
              <div key={address} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 12, color: COLORS.textDim, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%'
                  }}>{address}</span>
                  <span style={{ fontWeight: 900, color: COLORS.green }}>{balance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nodes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px,1fr))', gap: 18 }}>
        {nodes.map((node) => (
          <div key={node.port} style={{ ...card, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: 18, borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.03)' }}>
              <div style={nodeHeaderRow}>
                <h3 style={{ margin: 0, letterSpacing: 1 }}>{node.name}</h3>
                <span style={statusBadge(node.status)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background:
                    node.status === 'online' ? COLORS.green : node.status === 'offline' ? COLORS.red : COLORS.white,
                    display: 'inline-block'
                  }} />
                  {node.status}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, color: COLORS.textDim, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Port</span><strong style={{ color: COLORS.white }}>{node.port}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Chain</span><strong style={{ color: COLORS.white }}>{node.chainLength || 0}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Updated</span>
                  <strong style={{ color: COLORS.white }}>{node.lastUpdated ? node.lastUpdated.toLocaleTimeString() : '--'}</strong>
                </div>
              </div>
            </div>

            {node.status === 'online' ? (
              <div style={{ padding: 18 }}>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button onClick={() => mineBlock(node.url)} disabled={loading} style={btnGreen}>
                    <Coins size={14}/> Mine
                  </button>
                  <button onClick={() => resolveConsensus(node.url)} disabled={loading} style={btnNeutral}>
                    <Users size={14}/> Sync
                  </button>
                  <button
                    onClick={() => setSelectedNode(selectedNode?.port === node.port ? null : node)}
                    style={btnRed}
                  >
                    <Eye size={14}/> {selectedNode?.port === node.port ? 'Hide' : 'Details'}
                  </button>
                </div>

                {/* Account Balances (top 3) */}
                {Object.keys(node.state).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Account Balances</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(node.state).slice(0,3).map(([addr, bal]) => (
                        <div key={addr} style={{ ...card, padding: 10 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: COLORS.textDim, maxWidth: '70%', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</span>
                          <span style={{ float: 'right', fontWeight: 800, color: COLORS.white }}>{bal}</span>
                        </div>
                      ))}
                      {Object.keys(node.state).length > 3 && (
                        <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted }}>
                          +{Object.keys(node.state).length - 3} more accounts
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Blocks */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0' }}>Recent Blocks</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                    {node.chain.slice(-3).reverse().map((block, idx) => (
                      <div key={idx} style={{ ...card, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong>Block #{block.index}</strong>
                          <span style={{ ...subtle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={12}/> {formatTimestamp(block.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
                          <div><span style={{ color: COLORS.white, fontWeight: 700 }}>Hash:</span> {shortHash(block.previous_hash)}</div>
                          <div><span style={{ color: COLORS.white, fontWeight: 700 }}>Proof:</span> {block.proof}</div>
                        </div>
                        {block.transactions && block.transactions.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: COLORS.white }}>Transactions</div>
                            {block.transactions.slice(0,2).map((tx, tIdx) => (
                              <div key={tIdx} style={{ ...card, padding: 10 }}>
                                {tx.sender === '0' ? (
                                  <span style={{ color: COLORS.green, fontWeight: 700 }}>⚡ Reward: {tx.amount} → {tx.recipient}</span>
                                ) : typeof tx === 'object' && tx.sender ? (
                                  <span style={{ color: COLORS.white }}>💸 {tx.sender} → {tx.recipient}: <strong>{tx.amount}</strong></span>
                                ) : (
                                  <span style={{ color: COLORS.white }}>Genesis: {JSON.stringify(tx)}</span>
                                )}
                              </div>
                            ))}
                            {block.transactions.length > 2 && (
                              <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted }}>
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
                  <div style={{ marginTop: 12, ...card, padding: 12 }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Complete Chain Data</h4>
                    <div style={{ maxHeight: 384, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10 }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, color: COLORS.textDim }}>
                        {JSON.stringify(node.chain, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 18 }}>
                <div style={{ textAlign: 'center', color: COLORS.textDim }}>
                  <div style={{ display: 'inline-block', padding: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', marginBottom: 10 }}>
                    <AlertCircle color={COLORS.white} />
                  </div>
                  <div style={{ fontWeight: 700, color: COLORS.white }}>Node Offline</div>
                  <div style={{ fontSize: 13, color: COLORS.textDim }}>Unable to connect</div>
                  {node.error && (
                    <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,68,68,0.15)', color: COLORS.red, border: `1px solid ${COLORS.red}` }}>
                      {node.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 36, textAlign: 'center', color: COLORS.textMuted }}>
        Neon Chain Console — feature‑complete dashboard
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default FuturisticBlockchainDashboard;
