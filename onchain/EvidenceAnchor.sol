// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stores only a digest of an offchain continuity manifest.
/// @dev The caller's address is the authority. No project documents or chat text are stored here.
contract EvidenceAnchor {
    mapping(address => mapping(bytes32 => bytes32)) public latestRoot;

    event Anchored(address indexed owner, bytes32 indexed projectKey, bytes32 root, uint256 timestamp);

    function anchor(bytes32 projectKey, bytes32 root) external {
        require(projectKey != bytes32(0), "empty project key");
        require(root != bytes32(0), "empty root");
        latestRoot[msg.sender][projectKey] = root;
        emit Anchored(msg.sender, projectKey, root, block.timestamp);
    }

    function verify(address owner, bytes32 projectKey, bytes32 root) external view returns (bool) {
        return root != bytes32(0) && latestRoot[owner][projectKey] == root;
    }
}
