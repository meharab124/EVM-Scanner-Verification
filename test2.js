const { ethers } = require("ethers");
const solc = require('solc');
const fs = require('fs');

const provider = new ethers.JsonRpcProvider("https://rpc-testnet.devolvedai.com/");
const contractAddress = "0xc30877a08e90bd8bb9eaee9566d4c8846b2307cc"; // user

let deployedBytecode;

async function getDeployedBytecode() {
    try {
        deployedBytecode = await provider.getCode(contractAddress);
        console.log("Deployed Bytecode:", deployedBytecode);
    } catch (error) {
        console.error("Error fetching deployed bytecode:", error);
    }
}

const solcVersion = 'v0.8.17+commit.8df45f5f'; // user
const sourceCode = `
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.17;

// import "hardhat/console.sol";

/**
 * @title Owner
 * @dev Set & change owner
 */
contract Owner {

    address private owner;

    // event for EVM logging
    event OwnerSet(address indexed oldOwner, address indexed newOwner);

    // modifier to check if caller is owner
    modifier isOwner() {
        // If the first argument of 'require' evaluates to 'false', execution terminates and all
        // changes to the state and to Ether balances are reverted.
        // This used to consume all gas in old EVM versions, but not anymore.
        // It is often a good idea to use 'require' to check if functions are called correctly.
        // As a second argument, you can also provide an explanation about what went wrong.
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    /**
     * @dev Set contract deployer as owner
     */
    constructor() {
        // console.log("Owner contract deployed by:", msg.sender);
        owner = msg.sender; // 'msg.sender' is sender of current call, contract deployer for a constructor
        emit OwnerSet(address(0), owner);
    }

    /**
     * @dev Change owner
     * @param newOwner address of new owner
     */
    function changeOwner(address newOwner) public isOwner {
        require(newOwner != address(0), "New owner should not be the zero address");
        emit OwnerSet(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Return owner address 
     * @return address of owner
     */
    function getOwner() external view returns (address) {
        return owner;
    }
} 

`; // user

const input = {
    language: 'Solidity', // user
    sources: {
        'Owner.sol': {
            content: sourceCode,
        },
    },
    settings: {
        optimizer: {
            enabled: false, // user
            runs: 0, // user
        },
        evmVersion: 'london', // user
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.deployedBytecode.object'],
            },
        },
    },
};

function stripMetadata(bytecode) {
    if (bytecode.startsWith('0x')) {
        bytecode = bytecode.slice(2);
    }
    const metadataMarker = 'a2646970667358';
    const metadataIndex = bytecode.indexOf(metadataMarker);
    return metadataIndex === -1 ? bytecode : bytecode.slice(0, metadataIndex);
}

function matchContractBytecode(generatedBytecode, contractBytecode) {
    if (generatedBytecode.startsWith('0x')) {
        generatedBytecode = generatedBytecode.slice(2);
    }
    if (contractBytecode.startsWith('0x')) {
        contractBytecode = contractBytecode.slice(2);
    }


    const strippedGeneratedBytecode = stripMetadata(generatedBytecode);
    const strippedContractBytecode = stripMetadata(contractBytecode);
    console.log(strippedGeneratedBytecode);
    console.log(strippedGeneratedBytecode.length);
    console.log(strippedContractBytecode);
    console.log(strippedContractBytecode.length);

    return strippedGeneratedBytecode === strippedContractBytecode;
}

async function loadCompilerVersion(solcVersion) {
    return new Promise((resolve, reject) => {
        solc.loadRemoteVersion(solcVersion, (err, snapshot) => {
            if (err) {
                reject(err);
            } else {
                resolve(snapshot);
            }
        });
    });
}

async function compileAndVerify() {
    await getDeployedBytecode();

    try {
        const solcSnapshot = await loadCompilerVersion(solcVersion);

        const compiledOutput = JSON.parse(solcSnapshot.compile(JSON.stringify(input)));

        if (compiledOutput.errors) {
            compiledOutput.errors.forEach(err => console.error(err.formattedMessage));
        }

        const generatedBytecode = compiledOutput.contracts['Owner.sol'].Owner.evm.deployedBytecode.object;
        const abi = compiledOutput.contracts['Owner.sol'].Owner.abi;

        fs.writeFileSync('Owner_Bytecode.txt', generatedBytecode);
        fs.writeFileSync('Owner_ABI.json', JSON.stringify(abi, null, 2));

        console.log("Generated Runtime Bytecode:", generatedBytecode);
        console.log("ABI:", JSON.stringify(abi, null, 2));

        const isMatch = matchContractBytecode(generatedBytecode, deployedBytecode);

        if (isMatch) {
            console.log("Verification successful! Bytecode matches.");
        } else {
            console.log("Verification failed: Bytecode mismatch.");
        }
    } catch (error) {
        console.error('Error during verification:', error);
    }
}

compileAndVerify();
