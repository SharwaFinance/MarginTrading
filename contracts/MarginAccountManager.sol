pragma solidity 0.8.20;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SharwaFinance
 * Copyright (C) 2025 SharwaFinance
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **/

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IMarginAccountManager} from "./interfaces/IMarginAccountManager.sol";

/**
 * @title MarginAccountManager
 * @dev This contract manages margin accounts represented as ERC721 tokens.
 * @notice Users can create margin accounts using the `createMarginAccount` function.
 * @author 0nika0
 */
contract MarginAccountManager is IMarginAccountManager, ERC721("MarginAccountToken", "MAT") {
    uint public nextTokenID = 0;

    function createMarginAccount() external returns (uint marginAccountID) {
        marginAccountID = nextTokenID;
        _safeMint(msg.sender, marginAccountID);
        nextTokenID++;

        emit CreateMarginAccount(marginAccountID);
    }

    function isApprovedOrOwner(address spender, uint tokenID)
        external
        view
        returns (bool)
    {
        return _isApprovedOrOwner(spender, tokenID);
    }
}
