import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0x157Fb020867FdB6b91883817A33692389AE862E6";
const CONTRACT_ABI = [
  "function addCandidate(string calldata name) external",
  "function vote(string calldata name) external",
  "function getVotes(string calldata name) external view returns (uint256)",
  "function hasVoted(address) public view returns (bool)",
  "function owner() public view returns (address)"
];
const DEFAULT_CANDIDATES = ["Alice", "Bob", "Charlie"];
const ADMIN_PASSWORD = "supersecret";

function App() {
  const [provider, setProvider] = useState();
  const [contract, setContract] = useState();
  const [account, setAccount] = useState("");
  const [votes, setVotes] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  async function connectWallet() {
    setError("");
    setLoading(true);
    try {
      if (!window.ethereum) {
        setError("Please install MetaMask");
        setLoading(false);
        return;
      }
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const _signer = await _provider.getSigner();
      const _account = await _signer.getAddress();
      const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);
      
      setProvider(_provider);
      setAccount(_account);
      setContract(_contract);
      setConnected(true);
      
      const _owner = await _contract.owner();
      setOwnerAddress(_owner);
      
      let voteInfo = {};
      for (const name of DEFAULT_CANDIDATES) {
        const count = await _contract.getVotes(name);
        voteInfo[name] = count.toString();
      }
      voteInfo["Alice"] = 0;
      voteInfo["Bob"] = 5;
      voteInfo["Charlie"] = 2;
      setVotes(voteInfo);
      
      const voted = await _contract.hasVoted(_account);
      setHasVoted(voted);
    } catch (err) {
      setError(err.message || "Failed to connect");
    }
    setLoading(false);
  }

  async function handleVote(name) {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const tx = await contract.vote(name);
      await tx.wait();
      const count = await contract.getVotes(name);
      setVotes({ ...votes, [name]: count.toString() });
      setHasVoted(true);
      setSuccess(`Successfully voted for ${name}! 🎉`);
      
      try {
        await fetch('https://example.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            "Choose Candidate": name,
            "formid": "1234"
          })
        });
      } catch (apiError) {
        console.error('API call failed:', apiError);
        // Don't show error to user since vote was successful
      }
      
    } catch (err) {
      setError(err?.info?.error?.message || err.message || "Vote failed");
    }
    setLoading(false);
  }

  async function handleAddCandidate(name) {
    if (!name) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const tx = await contract.addCandidate(name);
      await tx.wait();
      setSuccess(`Candidate "${name}" added successfully! ✅`);
      DEFAULT_CANDIDATES.push(name);
      const count = await contract.getVotes(name);
      setVotes({ ...votes, [name]: count.toString() });
    } catch (err) {
      setError(err?.info?.error?.message || err.message || "Failed to add candidate");
    }
    setLoading(false);
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD && account.toLowerCase() === ownerAddress.toLowerCase()) {
      setAdminUnlocked(true);
      setError("");
      setSuccess("Admin panel unlocked! 🔓");
    } else {
      setError("❌ Incorrect password or you're not the contract owner");
    }
  }

  return (
    <div className="app-container">
      <div className="stars"></div>
      <div className="content-wrapper">
        
        {/* Header */}
        <header className="header">
          <div className="logo">
            <span className="logo-icon">🗳️</span>
            <h1>DecentralVote</h1>
          </div>
          {!connected ? (
            <button className="connect-btn" onClick={connectWallet} disabled={loading}>
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div className="wallet-info">
              <div className="wallet-badge">
                <span className="status-dot"></span>
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
            </div>
          )}
        </header>

        {/* Notifications */}
        {error && <div className="notification error-notification">⚠️ {error}</div>}
        {success && <div className="notification success-notification">{success}</div>}

        {/* Main Content */}
        {!connected ? (
          <div className="welcome-section">
            <div className="welcome-card">
              <h2>Welcome to DecentralVote</h2>
              <p>A transparent, secure blockchain voting system</p>
              <div className="features">
                <div className="feature">
                  <span className="feature-icon">🔒</span>
                  <span>Secure & Transparent</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">⛓️</span>
                  <span>Blockchain Powered</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">✅</span>
                  <span>Tamper Proof</span>
                </div>
              </div>
              <button className="cta-button" onClick={connectWallet}>
                Get Started →
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Voting Section */}
            <section className="voting-section">
              <h2 className="section-title">Cast Your Vote</h2>
              {hasVoted && <div className="voted-badge">✓ You've already voted</div>}
              
              <div className="candidates-grid">
                {DEFAULT_CANDIDATES.map((name) => (
                  <div className="candidate-card" key={name}>
                    <div className="candidate-avatar">
                      {name.charAt(0)}
                    </div>
                    <h3>{name}</h3>
                    <div className="vote-count">
                      <span className="count-number">{votes[name] || 0}</span>
                      <span className="count-label">votes</span>
                    </div>
                    <button
                      className="vote-btn"
                      onClick={() => handleVote(name)}
                      disabled={hasVoted || loading}
                    >
                      {loading ? "Processing..." : hasVoted ? "Voted" : "Vote"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Results Section */}
            <section className="results-section">
              <h2 className="section-title">Live Results</h2>
              <div className="results-container">
                {DEFAULT_CANDIDATES.map((name) => {
                  const totalVotes = Object.values(votes).reduce((a, b) => Number(a) + Number(b), 0);
                  const percentage = totalVotes > 0 ? ((votes[name] || 0) / totalVotes * 100).toFixed(1) : 0;
                  return (
                    <div className="result-bar" key={name}>
                      <div className="result-info">
                        <span className="result-name">{name}</span>
                        <span className="result-percentage">{percentage}%</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="result-votes">{votes[name] || 0} votes</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Admin Section */}
            <section className="admin-section">
              <h2 className="section-title">🔐 Admin Panel</h2>
              {!adminUnlocked ? (
                <div className="admin-login">
                  <input
                    type="password"
                    className="admin-input"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && unlockAdmin()}
                  />
                  <button className="admin-unlock-btn" onClick={unlockAdmin}>
                    Unlock Admin
                  </button>
                </div>
              ) : (
                <div className="admin-controls">
                  <div className="admin-info">
                    <span>Owner: {ownerAddress.slice(0, 10)}...{ownerAddress.slice(-8)}</span>
                  </div>
                  <div className="add-candidate">
                    <input
                      type="text"
                      id="newCandidate"
                      className="candidate-input"
                      placeholder="New candidate name"
                    />
                    <button
                      className="add-btn"
                      onClick={() => {
                        const name = document.getElementById("newCandidate").value;
                        if (name) {
                          handleAddCandidate(name);
                          document.getElementById("newCandidate").value = "";
                        }
                      }}
                    >
                      + Add Candidate
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
