// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../contracts/bridge/token/TokenImplementation.sol";
import "forge-std/Test.sol";

import "forge-std/console.sol";

contract TestTokenImplementation is TokenImplementation, Test {
    uint256 constant SECP256K1_CURVE_ORDER =
        115792089237316195423570985008687907852837564279074904382605163141518161494337;

    struct InitiateParameters {
        string name;
        string symbol;
        uint8 decimals;
        uint64 sequence;
        address owner;
        uint16 chainId;
        bytes32 nativeContract;
    }

    function setupTestEnvironmentWithInitialize() public {
        InitiateParameters memory init;
        init.name = "Valuable Token";
        init.symbol = "VALU";
        init.decimals = 8;
        init.sequence = 1;
        init.owner = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;
        init.chainId = 1;
        init
            .nativeContract = 0x1337133713371337133713371337133713371337133713371337133713371337;

        initialize(
            init.name,
            init.symbol,
            init.decimals,
            init.sequence,
            init.owner,
            init.chainId,
            init.nativeContract
        );
    }

    function setupTestEnvironmentWithOldInitialize() public {
        InitiateParameters memory init;
        init.name = "Old Valuable Token";
        init.symbol = "OLD";
        init.decimals = 8;
        init.sequence = 1;
        init.owner = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;
        init.chainId = 1;
        init
            .nativeContract = 0x1337133713371337133713371337133713371337133713371337133713371337;

        _initializeNativeToken(
            init.name,
            init.symbol,
            init.decimals,
            init.sequence,
            init.owner,
            init.chainId,
            init.nativeContract
        );
    }

    function simulatePermitSignature(
        bytes32 walletPrivateKey,
        address spender,
        uint256 amount,
        uint256 deadline
    )
        public
        returns (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        // prepare signer allowing for tokens to be spent
        uint256 sk = uint256(walletPrivateKey);
        allower = vm.addr(sk);

        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                allower,
                spender,
                amount,
                nonces(allower),
                deadline
            )
        );

        bytes32 message = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
        (v, r, s) = vm.sign(sk, message);
    }

    function testPermit(
        bytes32 walletPrivateKey,
        uint256 amount,
        address spender
    ) public {
        vm.assume(walletPrivateKey != bytes32(0));
        vm.assume(uint256(walletPrivateKey) < SECP256K1_CURVE_ORDER);
        vm.assume(spender != address(0));

        // initialize TokenImplementation
        setupTestEnvironmentWithInitialize();

        // prepare signer allowing for tokens to be spent
        uint256 deadline = 10;
        (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = simulatePermitSignature(
                walletPrivateKey,
                spender,
                amount,
                deadline
            );

        // get allowance before calling permit
        uint256 allowanceBefore = allowance(allower, spender);

        // set allowance with permit
        permit(allower, spender, amount, deadline, v, r, s);
        uint256 allowanceAfter = allowance(allower, spender);

        require(
            allowanceAfter - allowanceBefore == amount,
            "allowance incorrect"
        );
    }

    function testFailPermitWithSameSignature(
        bytes32 walletPrivateKey,
        uint256 amount,
        address spender
    ) public {
        vm.assume(walletPrivateKey != bytes32(0));
        vm.assume(uint256(walletPrivateKey) < SECP256K1_CURVE_ORDER);
        vm.assume(spender != address(0));

        // initialize TokenImplementation
        setupTestEnvironmentWithInitialize();

        // prepare signer allowing for tokens to be spent
        uint256 deadline = 10;
        (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = simulatePermitSignature(
                walletPrivateKey,
                spender,
                amount,
                deadline
            );

        // set allowance with permit
        permit(allower, spender, amount, deadline, v, r, s);

        // try again... you shall not pass
        // NOTE: using "testFail" instead of "test" because
        // vm.expectRevert("ERC20Permit: invalid signature") does not work
        permit(allower, spender, amount, deadline, v, r, s);
    }

    function testFailPermitWithBadSignature(
        bytes32 walletPrivateKey,
        uint256 amount,
        address spender
    ) public {
        vm.assume(walletPrivateKey != bytes32(0));
        vm.assume(uint256(walletPrivateKey) < SECP256K1_CURVE_ORDER);
        vm.assume(spender != address(0));

        // initialize TokenImplementation
        setupTestEnvironmentWithInitialize();

        // avoid overflow for this test
        uint256 wrongAmount;
        unchecked {
            wrongAmount = amount + 1; // amount will never equal
        }

        // prepare signer allowing for tokens to be spent
        uint256 deadline = 10;
        (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = simulatePermitSignature(
                walletPrivateKey,
                spender,
                wrongAmount,
                deadline
            );

        // you shall not pass!
        // NOTE: using "testFail" instead of "test" because
        // vm.expectRevert("ERC20Permit: invalid signature") does not work
        permit(allower, spender, amount, deadline, v, r, s);
    }

    function testPermitWithSignatureUsedAfterDeadline(
        bytes32 walletPrivateKey,
        uint256 amount,
        address spender
    ) public {
        vm.assume(walletPrivateKey != bytes32(0));
        vm.assume(uint256(walletPrivateKey) < SECP256K1_CURVE_ORDER);
        vm.assume(spender != address(0));

        // initialize TokenImplementation
        setupTestEnvironmentWithInitialize();

        // prepare signer allowing for tokens to be spent
        uint256 deadline = 10;
        (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = simulatePermitSignature(
                walletPrivateKey,
                spender,
                amount,
                deadline
            );

        // waited too long
        vm.warp(deadline + 1);

        // and fail
        vm.expectRevert("ERC20Permit: expired deadline");
        permit(allower, spender, amount, deadline, v, r, s);
    }

    function testInitializePermitState() public {
        // initialize TokenImplementation as if it were the old implementation
        setupTestEnvironmentWithOldInitialize();
        require(!permitInitialized(), "permit state should not be initialized");
        require(_state.cachedSalt == bytes32(0), "cachedSalt is set");

        // explicity call private method
        _initializePermitStateIfNeeded();
        require(permitInitialized(), "permit state should be initialized");
        require(_state.cachedSalt == _salt(), "salt not cached");

        // check permit state variables
        require(
            _state.cachedChainId == block.chainid,
            "_state.cachedChainId != expected"
        );
        require(
            _state.cachedDomainSeparator ==
                keccak256(
                    abi.encode(
                        keccak256(
                            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
                        ),
                        keccak256(abi.encodePacked(_state.name)),
                        keccak256(abi.encodePacked(_version())),
                        block.chainid,
                        address(this),
                        keccak256(abi.encodePacked(chainId(), nativeContract()))
                    )
                ),
            "_state.cachedDomainSeparator != expected"
        );
        require(
            _buildDomainSeparator() ==
                keccak256(
                    abi.encode(
                        keccak256(
                            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
                        ),
                        keccak256(abi.encodePacked(_state.name)),
                        keccak256(abi.encodePacked(_version())),
                        block.chainid,
                        address(this),
                        keccak256(abi.encodePacked(chainId(), nativeContract()))
                    )
                ),
            "_buildDomainSeparator() != expected"
        );
        require(
            _state.cachedThis == address(this),
            "_state.cachedThis != expected"
        );
    }

    function testPermitForPreviouslyDeployedImplementation(
        bytes32 walletPrivateKey,
        uint256 amount,
        address spender
    ) public {
        vm.assume(walletPrivateKey != bytes32(0));
        vm.assume(uint256(walletPrivateKey) < SECP256K1_CURVE_ORDER);
        vm.assume(spender != address(0));

        // initialize TokenImplementation as if it were the old implementation
        setupTestEnvironmentWithOldInitialize();
        require(!permitInitialized(), "permit state should not be initialized");
        require(_state.cachedSalt == bytes32(0), "cachedSalt is set");

        // prepare signer allowing for tokens to be spent
        uint256 deadline = 10;
        (
            address allower,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = simulatePermitSignature(
                walletPrivateKey,
                spender,
                amount,
                deadline
            );

        // get allowance before calling permit
        uint256 allowanceBefore = allowance(allower, spender);

        // set allowance with permit
        permit(allower, spender, amount, deadline, v, r, s);

        uint256 allowanceAfter = allowance(allower, spender);

        require(
            allowanceAfter - allowanceBefore == amount,
            "allowance incorrect"
        );
    }

    function testGetEip712Domain() public {
        // initialize TokenImplementation
        setupTestEnvironmentWithInitialize();

        (
            bytes1 domainFields,
            string memory domainName,
            string memory domainVersion,
            uint256 domainChainId,
            address domainVerifyingContract,
            bytes32 domainSalt,
            uint256[] memory domainExtensions
        ) = eip712Domain();
        require(domainFields == hex"1F", "domainFields != expected");
        require(
            keccak256(abi.encodePacked(domainName)) ==
                keccak256(abi.encodePacked(_state.name)),
            "domainName != expected"
        );
        require(
            keccak256(abi.encodePacked(domainVersion)) ==
                keccak256(abi.encodePacked("1")),
            "domainVersion != expected"
        );
        require(
            keccak256(abi.encodePacked(domainVersion)) ==
                keccak256(abi.encodePacked(_version())),
            "domainVersion != _version()"
        );
        require(domainChainId == block.chainid, "domainFields != expected");
        require(
            domainChainId == _state.cachedChainId,
            "domainFields != _state.cachedChainId"
        );
        require(
            domainVerifyingContract == address(this),
            "domainVerifyingContract != expected"
        );
        require(
            domainVerifyingContract == _state.cachedThis,
            "domainVerifyingContract != _state.cachedThis"
        );
        require(
            domainSalt ==
                keccak256(abi.encodePacked(chainId(), nativeContract())),
            "domainFields != expected"
        );
        require(
            domainSalt == _state.cachedSalt,
            "domainFields != _state.cachedSalt"
        );
        require(domainExtensions.length == 0, "domainExtensions.length != 0");
    }
}
