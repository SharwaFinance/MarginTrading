// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol"; // Import ERC721Receiver

interface IMarginAccountManager is IERC721 {
    function isApprovedOrOwner(address spender, uint256 tokenID) external view returns (bool);
    function nextTokenId() external view returns (uint256);
}

contract MockPositionsManager is IMarginAccountManager {
    mapping(uint256 => address) private _owners;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02; // Define ERC721_RECEIVED
    uint256 private _nextTokenId = 0;

    function createOptionFor(address holder)
        public
        returns (uint256 id)
    {
        id = _nextTokenId;
        mint(holder);   
    }


    function mint(address to) public {
        uint256 tokenID = _nextTokenId;
        _owners[tokenID] = to;
        _nextTokenId++;
        emit Transfer(address(0), to, tokenID);
    }

    function approve(address to, uint256 tokenID) external override {
        address owner = ownerOf(tokenID);
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not approved");
        _tokenApprovals[tokenID] = to;
        emit Approval(owner, to, tokenID);
    }

    function transferFrom(address from, address to, uint256 tokenID) public override {
        address owner = ownerOf(tokenID);
        require(msg.sender == owner || getApproved(tokenID) == msg.sender || isApprovedForAll(owner, msg.sender), "Transfer not approved");
        require(owner == from, "Not the token owner");
        _owners[tokenID] = to;
        emit Transfer(from, to, tokenID);
    }

    function ownerOf(uint256 tokenID) public view override returns (address) {
        return _owners[tokenID];
    }

    function getApproved(uint256 tokenID) public view override returns (address) {
        return _tokenApprovals[tokenID];
    }

    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function setApprovalForAll(address operator, bool approved) external override {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedOrOwner(address spender, uint256 tokenID) external view override returns (bool) {
        address owner = ownerOf(tokenID);
        return (spender == owner || getApproved(tokenID) == spender || isApprovedForAll(owner, spender));
    }

    function nextTokenId() external view override returns (uint256) {
        return _nextTokenId;
    }

    function balanceOf(address owner) external override view returns (uint256 balance) {}

    function safeTransferFrom(address from, address to, uint256 tokenID) external override {
        address owner = ownerOf(tokenID);
        require(msg.sender == owner || getApproved(tokenID) == msg.sender || isApprovedForAll(owner, msg.sender), "Transfer not approved");
        require(owner == from, "Not the token owner");
        _owners[tokenID] = to;
        emit Transfer(from, to, tokenID);
    }

    function safeTransferFrom(address from, address to, uint256 tokenID, bytes calldata data) external override {}

    function supportsInterface(bytes4 interfaceId) external override view returns (bool) {}

}
