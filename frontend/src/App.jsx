import React, { useState, useEffect } from 'react';
import { Activity, Server, Coins, Users, Hash, Clock, AlertCircle, CheckCircle, RefreshCw, Plus, Send, Eye, TrendingUp } from 'lucide-react';

const BlockchainDashboard = () => {
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
    networkHealth: 'Unknown'
  });

  // Default nodes configuration
  const DEFAULT_NODES = [
    { url: 'http://127.0.0.1:5000', name: 'Node 1', port: 5000 },
    { url: 'http://127.0.0.1:5001', name: 'Node 2', port: 5001 },
    { url: 'http://127.0.0.1:5002', name: 'Node 3', port: 5002 },
    { url: 'http://127.0.0.1:5003', name: 'Node 4', port: 5003 },
    { url: 'http://127.0.0.1:5004', name: 'Node 5', port: 5004 },
    { url: 'http://127.0.0.1:5005', name: 'Node 6', port: 5005 },
    { url: 'http://127.0.0.1:5006', name: 'Node 7', port: 5006 },
    { url: 'http://127.0.0.1:5007', name: 'Node 8', port: 5007 },
    { url: 'http://127.0.0.1:5008', name: 'Node 9', port: 5008 },
    { url: 'http://127.0.0.1:5009', name: 'Node 10', port: 5009 },
    { url: 'http://127.0.0.1:5010', name: 'Node 11', port: 5010 },
    { url: 'http://127.0.0.1:5011', name: 'Node 12', port: 5011 },
    { url: 'http://127.0.0.1:5012', name: 'Node 13', port: 5012 },
    { url: 'http://127.0.0.1:5013', name: 'Node 14', port: 5013 },
    { url: 'http://127.0.0.1:5014', name: 'Node 15', port: 5014 },
    { url: 'http://127.0.0.1:5015', name: 'Node 16', port: 5015 },
    { url: 'http://127.0.0.1:5016', name: 'Node 17', port: 5016 },
    { url: 'http://127.0.0.1:5017', name: 'Node 18', port: 5017 },
    { url: 'http://127.0.0.1:5018', name: 'Node 19', port: 5018 },
    { url: 'http://127.0.0.1:5019', name: 'Node 20', port: 5019 }
  ];

  useEffect(() => {
    setNodes(DEFAULT_NODES.map(node => ({ ...node, status: 'checking', chain: [], state: {}, error: null })));
    fetchAllNodesData();
  }, []);

  useEffect(() => {
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(fetchAllNodesData, 3000);
    }
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
          } else {
            throw new Error(`HTTP ${chainResponse.status}`);
          }
        } catch (error) {
          return {
            ...node,
            status: 'offline',
            chain: [],
            chainLength: 0,
            state: {},
            error: error.message,
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
    const onlineNodes = nodeList.filter(node => node.status === 'online');
    const totalBlocks = Math.max(...onlineNodes.map(node => node.chainLength), 0);
    const totalTransactions = onlineNodes.reduce((sum, node) => {
      return sum + node.chain.reduce((blockSum, block) => blockSum + (block.transactions?.length || 0), 0);
    }, 0);

    // Merge all states to get global state
    const mergedState = {};
    onlineNodes.forEach(node => {
      Object.keys(node.state).forEach(address => {
        if (!mergedState[address] || node.chainLength >= (mergedState[address].chainLength || 0)) {
          mergedState[address] = {
            balance: node.state[address],
            chainLength: node.chainLength
          };
        }
      });
    });

    const globalStateBalances = {};
    Object.keys(mergedState).forEach(address => {
      globalStateBalances[address] = mergedState[address].balance;
    });

    setGlobalState(globalStateBalances);

    const healthPercentage = (onlineNodes.length / nodeList.length) * 100;
    const networkHealth = healthPercentage >= 80 ? 'Healthy' : healthPercentage >= 50 ? 'Degraded' : 'Critical';

    setNetworkStats({
      totalNodes: onlineNodes.length,
      totalBlocks,
      totalTransactions,
      networkHealth,
      healthPercentage
    });
  };

  const mineBlock = async (nodeUrl) => {
    try {
      setLoading(true);
      const response = await fetch(`${nodeUrl}/mine`);
      if (response.ok) {
        const result = await response.json();
        console.log('Mining successful:', result);
        await fetchAllNodesData();
      }
    } catch (error) {
      console.error('Mining failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveConsensus = async (nodeUrl) => {
    try {
      setLoading(true);
      const response = await fetch(`${nodeUrl}/nodes/resolve`);
      if (response.ok) {
        const result = await response.json();
        console.log('Consensus resolved:', result);
        await fetchAllNodesData();
      }
    } catch (error) {
      console.error('Consensus failed:', error);
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
      const nodeUrl = selectedNode?.url || DEFAULT_NODES[0].url;
      const response = await fetch(`${nodeUrl}/transactions/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: newTransaction.sender,
          recipient: newTransaction.recipient,
          amount: parseFloat(newTransaction.amount)
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Transaction submitted:', result);
        setNewTransaction({ sender: '', recipient: '', amount: '' });
        setShowTransactionForm(false);
        await fetchAllNodesData();
      } else {
        const error = await response.text();
        alert(`Transaction failed: ${error}`);
      }
    } catch (error) {
      console.error('Transaction submission failed:', error);
      alert(`Transaction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    };

    switch (status) {
      case 'online': 
        return { ...baseStyle, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
      case 'offline': 
        return { ...baseStyle, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };
      case 'checking': 
        return { ...baseStyle, backgroundColor: '#fefce8', color: '#ca8a04', border: '1px solid #fde047' };
      default: 
        return { ...baseStyle, backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' };
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatHash = (hash) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const containerStyle = {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box'
  };

  const mainContainerStyle = {
    width: '100%',
    margin: '0',
    boxSizing: 'border-box'
  };

  const headerStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const titleStyle = {
    fontSize: '2.5rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '10px'
  };

  const subtitleStyle = {
    fontSize: '1.1rem',
    color: '#64748b',
    marginBottom: '30px'
  };

  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb'
  };

  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginTop: '30px'
  };

  const statCardStyle = {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  };

  const actionsContainerStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    marginBottom: '30px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const nodesGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '24px',
    width: '100%'
  };

  const nodeCardStyle = {
    backgroundColor: 'white',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  };

  const nodeHeaderStyle = {
    background: 'linear-gradient(135deg, #1e293b, #334155)',
    padding: '24px',
    color: 'white'
  };

  const inputStyle = {
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
    outline: 'none',
    width: '100%'
  };

  return (
    <div style={containerStyle}>
      <div style={mainContainerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
            <div>
              <h1 style={titleStyle}>🔗 Blockchain Network</h1>
              <p style={subtitleStyle}>Real-time monitoring and management dashboard</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                style={{
                  ...buttonStyle,
                  backgroundColor: isAutoRefresh ? '#10b981' : 'white',
                  color: isAutoRefresh ? 'white' : '#374151',
                  border: isAutoRefresh ? 'none' : '1px solid #e5e7eb'
                }}
              >
                <Activity size={16} style={{ animation: isAutoRefresh ? 'pulse 2s infinite' : 'none' }} />
                Auto Refresh {isAutoRefresh ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={fetchAllNodesData}
                disabled={loading}
                style={{
                  ...primaryButtonStyle,
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>
          </div>

          {/* Network Stats */}
          <div style={statsGridStyle}>
            <div style={{...statCardStyle, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <div>
                  <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Active Nodes</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '4px' }}>{networkStats.totalNodes}</p>
                  <p style={{ fontSize: '12px', opacity: '0.7' }}>out of {DEFAULT_NODES.length}</p>
                </div>
                <Server size={32} style={{ opacity: '0.8' }} />
              </div>
            </div>

            <div style={{...statCardStyle, background: 'linear-gradient(135deg, #10b981, #059669)'}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <div>
                  <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Total Blocks</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '4px' }}>{networkStats.totalBlocks}</p>
                  <p style={{ fontSize: '12px', opacity: '0.7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> Chain length
                  </p>
                </div>
                <Hash size={32} style={{ opacity: '0.8' }} />
              </div>
            </div>

            <div style={{...statCardStyle, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <div>
                  <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Transactions</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '4px' }}>{networkStats.totalTransactions}</p>
                  <p style={{ fontSize: '12px', opacity: '0.7' }}>processed</p>
                </div>
                <Send size={32} style={{ opacity: '0.8' }} />
              </div>
            </div>

            <div style={{
              ...statCardStyle, 
              background: networkStats.networkHealth === 'Healthy' ? 'linear-gradient(135deg, #10b981, #059669)' : 
                         networkStats.networkHealth === 'Degraded' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 
                         'linear-gradient(135deg, #ef4444, #dc2626)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <div>
                  <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Network Health</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '4px' }}>{networkStats.networkHealth}</p>
                  <p style={{ fontSize: '12px', opacity: '0.7' }}>{networkStats.healthPercentage?.toFixed(0)}% operational</p>
                </div>
                {networkStats.networkHealth === 'Healthy' ? 
                  <CheckCircle size={32} style={{ opacity: '0.8' }} /> : 
                  <AlertCircle size={32} style={{ opacity: '0.8' }} />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div style={actionsContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowTransactionForm(!showTransactionForm)}
              style={{ ...primaryButtonStyle, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
            >
              <Plus size={20} />
              New Transaction
            </button>
            <button
              onClick={() => nodes.forEach(node => node.status === 'online' && mineBlock(node.url))}
              disabled={loading}
              style={{ 
                ...primaryButtonStyle, 
                background: 'linear-gradient(135deg, #10b981, #059669)',
                opacity: loading ? 0.5 : 1
              }}
            >
              <Coins size={20} />
              Mine All Nodes
            </button>
            <button
              onClick={() => nodes.forEach(node => node.status === 'online' && resolveConsensus(node.url))}
              disabled={loading}
              style={{ 
                ...primaryButtonStyle, 
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                opacity: loading ? 0.5 : 1
              }}
            >
              <Users size={20} />
              Sync All Nodes
            </button>
          </div>

          {/* Transaction Form */}
          {showTransactionForm && (
            <div style={{ 
              marginTop: '30px', 
              padding: '24px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0' 
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>
                Create New Transaction
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Sender address"
                  value={newTransaction.sender}
                  onChange={(e) => setNewTransaction({...newTransaction, sender: e.target.value})}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <input
                  type="text"
                  placeholder="Recipient address"
                  value={newTransaction.recipient}
                  onChange={(e) => setNewTransaction({...newTransaction, recipient: e.target.value})}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={submitTransaction}
                  disabled={loading}
                  style={{
                    ...primaryButtonStyle,
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  <Send size={16} />
                  Submit Transaction
                </button>
                <button
                  onClick={() => setShowTransactionForm(false)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#6b7280',
                    color: 'white'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global State */}
        {Object.keys(globalState).length > 0 && (
          <div style={actionsContainerStyle}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              marginBottom: '24px', 
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ padding: '8px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <Coins size={20} style={{ color: '#f59e0b' }} />
              </div>
              Global Account Balances
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {Object.entries(globalState).map(([address, balance]) => (
                <div key={address} style={{
                  background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px', 
                      color: '#92400e', 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60%'
                    }}>
                      {address}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>{balance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nodes Grid */}
        <div style={nodesGridStyle}>
          {nodes.map((node) => (
            <div key={node.port} style={nodeCardStyle}>
              {/* Node Header */}
              <div style={nodeHeaderStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', margin: '0' }}>{node.name}</h3>
                  <span style={getStatusStyle(node.status)}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      marginRight: '6px',
                      backgroundColor: node.status === 'online' ? '#10b981' : 
                                     node.status === 'offline' ? '#ef4444' : '#f59e0b'
                    }}></div>
                    {node.status}
                  </span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Port:</span>
                    <span style={{ fontWeight: '500' }}>{node.port}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Chain Length:</span>
                    <span style={{ fontWeight: '500' }}>{node.chainLength || 0}</span>
                  </div>
                  {node.lastUpdated && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                      Last Updated: {node.lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {node.status === 'online' ? (
                <div style={{ padding: '24px' }}>
                  {/* Node Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => mineBlock(node.url)}
                      disabled={loading}
                      style={{
                        ...buttonStyle,
                        fontSize: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      <Coins size={14} />
                      Mine
                    </button>
                    <button
                      onClick={() => resolveConsensus(node.url)}
                      disabled={loading}
                      style={{
                        ...buttonStyle,
                        fontSize: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#e9d5ff',
                        color: '#581c87',
                        border: '1px solid #c4b5fd',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      <Users size={14} />
                      Sync
                    </button>
                    <button
                      onClick={() => setSelectedNode(selectedNode?.port === node.port ? null : node)}
                      style={{
                        ...buttonStyle,
                        fontSize: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        border: '1px solid #93c5fd'
                      }}
                    >
                      <Eye size={14} />
                      {selectedNode?.port === node.port ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {/* Account Balances */}
                  {Object.keys(node.state).length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
                        Account Balances
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(node.state).slice(0, 3).map(([address, balance]) => (
                          <div key={address} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              color: '#475569',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '70%'
                            }}>
                              {address}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{balance}</span>
                          </div>
                        ))}
                        {Object.keys(node.state).length > 3 && (
                          <div style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', padding: '8px' }}>
                            +{Object.keys(node.state).length - 3} more accounts
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Blocks */}
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
                      Recent Blocks
                    </h4>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      maxHeight: '320px',
                      overflowY: 'auto'
                    }}>
                      {node.chain.slice(-3).reverse().map((block, blockIndex) => (
                        <div key={blockIndex} style={{
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                          }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                              Block #{block.index}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Clock size={12} />
                              {formatTimestamp(block.timestamp)}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#475569',
                            marginBottom: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <p>
                              <span style={{ fontWeight: '500' }}>Hash:</span> {formatHash(block.previous_hash)}
                            </p>
                            <p>
                              <span style={{ fontWeight: '500' }}>Proof:</span> {block.proof}
                            </p>
                          </div>
                          {block.transactions && block.transactions.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <h5 style={{
                                fontSize: '11px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '8px'
                              }}>
                                Transactions
                              </h5>
                              {block.transactions.slice(0, 2).map((tx, txIndex) => (
                                <div key={txIndex} style={{
                                  fontSize: '11px',
                                  padding: '12px',
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {tx.sender === "0" ? (
                                    <span style={{ color: '#059669', fontWeight: '500' }}>
                                      ⚡ Mining Reward: {tx.amount} → {tx.recipient}
                                    </span>
                                  ) : typeof tx === 'object' && tx.sender ? (
                                    <span style={{ color: '#2563eb', fontWeight: '500' }}>
                                      💸 {tx.sender} → {tx.recipient}: {tx.amount}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#475569', fontWeight: '500' }}>
                                      🔮 Genesis: {JSON.stringify(tx)}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {block.transactions.length > 2 && (
                                <div style={{
                                  fontSize: '11px',
                                  color: '#6b7280',
                                  textAlign: 'center',
                                  padding: '4px'
                                }}>
                                  +{block.transactions.length - 2} more transactions
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded View */}
                  {selectedNode?.port === node.port && (
                    <div style={{
                      marginTop: '24px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '12px'
                      }}>
                        Complete Chain Data
                      </h4>
                      <div style={{
                        maxHeight: '384px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px'
                      }}>
                        <pre style={{
                          fontSize: '11px',
                          color: '#475569',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          margin: '0'
                        }}>
                          {JSON.stringify(node.chain, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '24px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '160px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '50%',
                        marginBottom: '16px',
                        display: 'inline-block'
                      }}>
                        <AlertCircle size={32} style={{ color: '#94a3b8' }} />
                      </div>
                      <p style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#475569',
                        marginBottom: '4px'
                      }}>
                        Node Offline
                      </p>
                      <p style={{ fontSize: '14px', color: '#6b7280' }}>
                        Unable to connect
                      </p>
                      {node.error && (
                        <p style={{
                          fontSize: '11px',
                          color: '#dc2626',
                          marginTop: '8px',
                          backgroundColor: '#fef2f2',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #fecaca'
                        }}>
                          {node.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8' }}>
            Blockchain Network Dashboard - Real-time monitoring and management
          </p>
        </div>
      </div>

      {/* Add keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BlockchainDashboard;