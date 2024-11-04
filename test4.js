const { ethers, AbiCoder } = require("ethers");
const solc = require('solc');
const fs = require('fs');

const provider = new ethers.JsonRpcProvider("https://rpc-testnet.devolvedai.com/");
const contractAddress = "0x57527606cfd0f6097169961eeab15580c0a9457c"; // user
const libraryAddress = '0xd623a6cc1460f3fc3cdc1d3582a790adb436b053'; // user

let deployedBytecode;

async function getDeployedBytecode() {
    try {
        deployedBytecode = await provider.getCode(contractAddress);
        console.log("Deployed Bytecode:", deployedBytecode);
    } catch (error) {
        console.error("Error fetching deployed bytecode:", error);
    }
}

const solcVersion = 'v0.8.24+commit.e11b9ed9'; // user
const sourceCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library MathLib {
    function add(uint a, uint b) public pure returns (uint) {
        return a + b;
    }
}

contract HelloWorld {
    using MathLib for uint;
    function sum(uint a, uint b) public pure returns (uint) {
        return a.add(b);
    }
}
`; // user

const input = {
    language: 'Solidity', // user
    sources: {
        'HelloWorld.sol': {
            content: sourceCode,
        },
    },
    settings: {
        optimizer: {
            enabled: true, // user
            runs: 200, // user
        },
        evmVersion: 'shanghai', // user
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

    console.log(generatedBytecode);
    console.log(generatedBytecode.length);
    console.log(contractBytecode);
    console.log(contractBytecode.length);
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

        const generatedBytecode = compiledOutput.contracts['HelloWorld.sol'].HelloWorld.evm.deployedBytecode.object;
        const abi = compiledOutput.contracts['HelloWorld.sol'].HelloWorld.abi;

        fs.writeFileSync('HelloWorld_Bytecode.txt', generatedBytecode);
        fs.writeFileSync('HelloWorld_ABI.json', JSON.stringify(abi, null, 2));

        console.log("Generated Runtime Bytecode:", generatedBytecode);
        console.log("ABI:", JSON.stringify(abi, null, 2));

        const cleanLibraryAddress = libraryAddress.slice(2);
        const placeholderPattern = /__\$[a-fA-F0-9]{34}\$__/g;
        const bytecodeWithLibrary = generatedBytecode.replace(placeholderPattern, cleanLibraryAddress);
        console.log("Compiled Bytecode with Library: ", bytecodeWithLibrary);

        const isMatch = matchContractBytecode(bytecodeWithLibrary, deployedBytecode);

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
