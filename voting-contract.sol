// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleVoting {
    address public owner;
    mapping(bytes32 => uint256) private _votes;     // candidateId -> votes
    mapping(bytes32 => bool) public isCandidate;    // candidateId registered?
    mapping(address => bool) public hasVoted;       // one vote per address

    event CandidateAdded(string name, bytes32 id);
    event Voted(address indexed voter, string candidate, uint256 newTotal);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // Owner registers a candidate by name
    function addCandidate(string calldata name) external onlyOwner {
        bytes32 id = keccak256(bytes(name));
        require(!isCandidate[id], "candidate exists");
        isCandidate[id] = true;
        emit CandidateAdded(name, id);
    }

    // Anyone can vote exactly once for a registered candidate
    function vote(string calldata name) external {
        require(!hasVoted[msg.sender], "already voted");
        bytes32 id = keccak256(bytes(name));
        require(isCandidate[id], "unknown candidate");

        hasVoted[msg.sender] = true;
        _votes[id] += 1;

        emit Voted(msg.sender, name, _votes[id]);
    }

    // Read current votes for any candidate name
    function getVotes(string calldata name) external view returns (uint256) {
        return _votes[keccak256(bytes(name))];
    }

    // Utility (optional): see the candidateId hash for a name
    function candidateId(string calldata name) external pure returns (bytes32) {
        return keccak256(bytes(name));
    }
}
