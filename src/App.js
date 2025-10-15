import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";
import CONTRACT_ABI from "./contractABI.json";

const CONTRACT_ADDRESS = "0x3A683DB571e2Af879D6331586a684218373f7498";
const DEFAULT_CANDIDATES = ["Alice", "Bob", "Charlie"];
const ADMIN_PASSWORD = "supersecret";

function App() {
  const [provider, setProvider] = useState();
  const [contract, setContract] = useState();
  const [account, setAccount] = useState("");
  const [candidates, setCandidates] = useState(DEFAULT_CANDIDATES);
  const [votes, setVotes] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Debug function to check contract deployment
  async function debugContract() {
    if (!provider) {
      console.log("No provider available");
      return;
    }
    
    try {
      // Check if there's code at the contract address
      const code = await provider.getCode(CONTRACT_ADDRESS);
      console.log("Contract code:", code);
      
      if (code === "0x") {
        console.error("❌ No contract deployed at this address!");
        setError("No contract found at the specified address. Please check your contract address and network.");
        return false;
      } else {
        console.log("✅ Contract found at address");
      }

      // Check network
      const network = await provider.getNetwork();
      console.log("Connected to network:", network.name, "Chain ID:", network.chainId);

      return true;
    } catch (error) {
      console.error("Debug error:", error);
      setError(`Debug error: ${error.message}`);
      return false;
    }
  }

  // Clean up event listeners when component unmounts or contract changes
  useEffect(() => {
    return () => {
      if (contract) {
        removeEventListeners(contract);
      }
    };
  }, [contract]);

  // Set up event listeners for the contract
  function setupEventListeners(contract) {
    // Listen for Voted events
    contract.on("Voted", (voter, candidate, newTotal) => {
      console.log(
        `Vote event: ${voter} voted for ${candidate}, new total: ${newTotal}`
      );
      setVotes((prevVotes) => ({
        ...prevVotes,
        [candidate]: newTotal.toString(),
      }));

      // Show success message if it's the current user
      if (voter.toLowerCase() === account.toLowerCase()) {
        setSuccess(`Successfully voted for ${candidate}! 🎉`);
      } else {
        setSuccess(`New vote for ${candidate}! Current total: ${newTotal}`);
      }
    });

    // Listen for CandidateAdded events
    contract.on("CandidateAdded", (name, id) => {
      console.log(`Candidate added: ${name}`);
      setCandidates((prevCandidates) => {
        if (!prevCandidates.includes(name)) {
          return [...prevCandidates, name];
        }
        return prevCandidates;
      });
      setVotes((prevVotes) => ({
        ...prevVotes,
        [name]: "0",
      }));
      setSuccess(`New candidate "${name}" added! ✅`);
    });
  }

  // Clean up event listeners
  function removeEventListeners(contract) {
    if (contract) {
      contract.removeAllListeners("Voted");
      contract.removeAllListeners("CandidateAdded");
    }
  }

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
      const _contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        _signer
      );

      setProvider(_provider);
      
      // Debug: Check if contract is deployed
      try {
        // Check network first
        const network = await _provider.getNetwork();
        console.log("Connected to network:", network.name, "Chain ID:", network.chainId);
        
        // Check if we're on Sepolia (Chain ID: 11155111)
        if (network.chainId !== 11155111n) {
          setError(`❌ Wrong network! Please switch MetaMask to Sepolia testnet. Currently on: ${network.name} (Chain ID: ${network.chainId})`);
          setLoading(false);
          return;
        }
        
        // Add retry logic for rate limiting
        let retries = 3;
        let code;
        
        while (retries > 0) {
          try {
            code = await _provider.getCode(CONTRACT_ADDRESS);
            break; // Success, exit retry loop
          } catch (codeError) {
            if (codeError.message.includes("circuit breaker") && retries > 1) {
              console.log(`Rate limited, retrying... (${retries - 1} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              retries--;
            } else {
              throw codeError; // Re-throw if not rate limiting or no retries left
            }
          }
        }
        
        console.log("Contract code:", code);
        
        if (code === "0x") {
          console.error("❌ No contract deployed at this address!");
          setError(`No contract found at address ${CONTRACT_ADDRESS} on Sepolia. Please verify your contract address.`);
          setLoading(false);
          return;
        } else {
          console.log("✅ Contract found at address on Sepolia");
        }
      } catch (debugError) {
        console.error("Debug error:", debugError);
        
        if (debugError.message.includes("circuit breaker")) {
          setError("❌ MetaMask rate limit reached. Please wait 30 seconds and try again, or restart MetaMask.");
        } else {
          setError(`Network error: ${debugError.message}`);
        }
        
        setLoading(false);
        return;
      }

      setAccount(_account);
      setContract(_contract);
      setConnected(true);

      const _owner = await _contract.owner();
      setOwnerAddress(_owner);

      // Get real vote counts from the contract
      let voteInfo = {};
      for (const name of candidates) {
        const count = await _contract.getVotes(name);
        voteInfo[name] = count.toString();
      }
      setVotes(voteInfo);

      const voted = await _contract.hasVoted(_account);
      setHasVoted(voted);

      // Set up event listeners for real-time updates
      setupEventListeners(_contract);
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
      // Event listener will handle the UI update automatically
      setHasVoted(true);

      try {
        await fetch("https://example.com", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "Choose Candidate": name,
            formid: "1234",
          }),
        });
      } catch (apiError) {
        console.error("API call failed:", apiError);
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
      // Event listener will handle the UI update automatically
    } catch (err) {
      setError(
        err?.info?.error?.message || err.message || "Failed to add candidate"
      );
    }
    setLoading(false);
  }

  async function registerDefaultCandidates() {
    setLoading(true);
    try {
      for (const candidate of DEFAULT_CANDIDATES) {
        try {
          console.log(`Checking if ${candidate} is already registered...`);
          // Check if candidate is already registered using candidateId function
          const candidateHash = await contract.candidateId(candidate);
          const isRegistered = await contract.isCandidate(candidateHash);
          
          if (!isRegistered) {
            console.log(`Registering ${candidate}...`);
            const tx = await contract.addCandidate(candidate);
            await tx.wait();
            console.log(`✅ ${candidate} registered successfully`);
          } else {
            console.log(`✅ ${candidate} already registered`);
          }
        } catch (candidateError) {
          console.error(`Error with candidate ${candidate}:`, candidateError);
        }
      }
      setSuccess("Default candidates registered! You can now vote. 🎉");
    } catch (error) {
      console.error("Error registering candidates:", error);
      setError(`Failed to register candidates: ${error.message}`);
    }
    setLoading(false);
  }

  function unlockAdmin() {
    if (
      adminPassword === ADMIN_PASSWORD &&
      account.toLowerCase() === ownerAddress.toLowerCase()
    ) {
      setAdminUnlocked(true);
      setError("");
      setSuccess("Admin panel unlocked! 🔓");
      
      // Automatically register default candidates
      registerDefaultCandidates();
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
            <button
              className="connect-btn"
              onClick={connectWallet}
              disabled={loading}
            >
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
        {error && (
          <div className="notification error-notification">⚠️ {error}</div>
        )}
        {success && (
          <div className="notification success-notification">{success}</div>
        )}

        {/* Contract Setup Helper */}
        {connected && account.toLowerCase() === ownerAddress.toLowerCase() && !adminUnlocked && (
          <div className="notification" style={{backgroundColor: '#e3f2fd', color: '#1565c0', border: '1px solid #1976d2'}}>
            💡 <strong>Contract Owner Detected!</strong> Unlock admin panel to register default candidates before voting.
          </div>
        )}

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
              {hasVoted && (
                <div className="voted-badge">✓ You've already voted</div>
              )}

              <div className="candidates-grid">
                {candidates.map((name) => (
                  <div className="candidate-card" key={name}>
                    <div className="candidate-avatar">{name.charAt(0)}</div>
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
                {candidates.map((name) => {
                  const totalVotes = Object.values(votes).reduce(
                    (a, b) => Number(a) + Number(b),
                    0
                  );
                  const percentage =
                    totalVotes > 0
                      ? (((votes[name] || 0) / totalVotes) * 100).toFixed(1)
                      : 0;
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
                      <span className="result-votes">
                        {votes[name] || 0} votes
                      </span>
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
                    onKeyPress={(e) => e.key === "Enter" && unlockAdmin()}
                  />
                  <button className="admin-unlock-btn" onClick={unlockAdmin}>
                    Unlock Admin
                  </button>
                </div>
              ) : (
                <div className="admin-controls">
                  <div className="admin-info">
                    <span>
                      Owner: {ownerAddress.slice(0, 10)}...
                      {ownerAddress.slice(-8)}
                    </span>
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
                        const name =
                          document.getElementById("newCandidate").value;
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
