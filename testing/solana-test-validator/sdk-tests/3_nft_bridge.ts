import { expect } from "chai";
import { BN } from "@project-serum/anchor";
import * as web3 from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  MockGuardians,
  NftBridgeGovernanceEmitter,
  MockEthereumNftBridge,
} from "../../../sdk/js/src/mock";
import { postVaa } from "../../../sdk/js/src/solana/sendAndConfirmPostVaa";
import {
  deriveSplTokenMetadataKey,
  deriveWormholeEmitterKey,
  getPostedMessage,
  getPostedVaa,
  NodeWallet,
  SplTokenMetadataProgram,
} from "../../../sdk/js/src/solana";
import {
  parseGovernanceVaa,
  parseNftBridgeRegisterChainVaa,
  parseNftTransferPayload,
  parseVaa,
} from "../../../sdk/js/src/vaa";

import {
  CORE_BRIDGE_ADDRESS,
  NFT_BRIDGE_ADDRESS,
  ETHEREUM_NFT_BRIDGE_ADDRESS,
  GOVERNANCE_EMITTER_ADDRESS,
  GUARDIAN_KEYS,
  GUARDIAN_SET_INDEX,
  LOCALHOST,
} from "./helpers/consts";
import { ethAddressToBuffer, now } from "./helpers/utils";
import {
  createApproveAuthoritySignerInstruction,
  createInitializeInstruction,
  createRegisterChainInstruction,
  createTransferNativeInstruction,
  deriveCustodyKey,
  deriveEndpointKey,
  getEndpointRegistration,
  getInitializeAccounts,
  getNftBridgeConfig,
  getRegisterChainAccounts,
  getTransferNativeAccounts,
} from "../../../sdk/js/src/solana/nftBridge";

describe("NFT Bridge", () => {
  const connection = new web3.Connection(LOCALHOST, "processed");

  const wallet = new NodeWallet(web3.Keypair.generate());

  // for signing wormhole messages
  const guardians = new MockGuardians(GUARDIAN_SET_INDEX + 1, GUARDIAN_KEYS);

  const localVariables: any = {};

  before("Airdrop SOL", async () => {
    await connection
      .requestAirdrop(wallet.key(), 1000 * web3.LAMPORTS_PER_SOL)
      .then(async (signature) => connection.confirmTransaction(signature));
  });

  before("Create NFT", async () => {
    localVariables.mint = await createMint(
      connection,
      wallet.signer(),
      wallet.key(),
      null,
      0
    );

    const tokenUri = Buffer.alloc(2);
    tokenUri.writeUint16BE(69, 0);
    localVariables.nftMeta = {
      name: "Space Cadets",
      symbol: "CADET",
      uri: tokenUri.toString("hex"),
    };

    const mint = localVariables.mint;
    const name = localVariables.nftMeta.name;
    const symbol = localVariables.nftMeta.symbol;
    const updateAuthorityIsSigner = false;
    const uri = localVariables.nftMeta.uri;
    const creators = undefined;
    const sellerFeeBasisPoints = 0;
    const isMutable = false;
    const createMetadataIx = SplTokenMetadataProgram.createMetadataAccounts(
      wallet.key(),
      mint,
      wallet.key(),
      name,
      symbol,
      wallet.key(),
      updateAuthorityIsSigner,
      uri,
      creators,
      sellerFeeBasisPoints,
      isMutable
    );

    const createMetadataTx = await web3.sendAndConfirmTransaction(
      connection,
      new web3.Transaction().add(createMetadataIx),
      [wallet.signer()],
      { skipPreflight: true }
    );
    console.log("createMatadataTx", createMetadataTx);

    localVariables.mintAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.signer(),
      localVariables.mint,
      wallet.key()
    ).then((account) => account.address);

    const mintToTx = await mintTo(
      connection,
      wallet.signer(),
      localVariables.mint,
      localVariables.mintAta,
      wallet.key(),
      1
    );
  });

  before("Create Mint with Metadata", async () => {
    // TODO
  });

  describe("Accounts", () => {
    // for generating governance wormhole messages
    const governance = new NftBridgeGovernanceEmitter(
      GOVERNANCE_EMITTER_ADDRESS.toBuffer().toString("hex")
    );

    // nft bridge on Ethereum
    const ethereumNftBridge = new MockEthereumNftBridge(
      ETHEREUM_NFT_BRIDGE_ADDRESS
    );

    const payer = new web3.PublicKey(
      "6sbzC1eH4FTujJXWj51eQe25cYvr4xfXbJ1vAj7j2k5J"
    );

    it("Instruction 0: Initialize", () => {
      const accounts = getInitializeAccounts(NFT_BRIDGE_ADDRESS, payer);

      // verify accounts
      expect(accounts.config.toString()).to.equal(
        "FEBC3gqEA3bto28QpBaJiw3zB2G1BS6AgUUrph9RSGkt"
      );
      expect(accounts.rent.equals(web3.SYSVAR_RENT_PUBKEY)).to.be.true;
      expect(accounts.systemProgram.equals(web3.SystemProgram.programId)).to.be
        .true;
    });

    it("Instruction 1: Complete Native", () => {
      const timestamp = 12345678;
      // TODO
    });

    it("Instruction 2: Complete Wrapped", () => {
      const timestamp = 23456789;
      // TODO
    });

    it("Instruction 3: Complete Wrapped Meta", () => {
      const timestamp = 34567890;
      // TODO
    });

    it("Instruction 4: Transfer Wrapped", () => {
      // TODO
    });

    it("Instruction 5: Transfer Native", async () => {
      const mint = NATIVE_MINT;
      const mintAta = await getAssociatedTokenAddress(mint, payer);

      const message = web3.Keypair.generate();
      const accounts = getTransferNativeAccounts(
        NFT_BRIDGE_ADDRESS,
        CORE_BRIDGE_ADDRESS,
        payer,
        message.publicKey,
        mintAta,
        mint
      );

      // verify accounts
      expect(accounts.config.toString()).to.equal(
        "FEBC3gqEA3bto28QpBaJiw3zB2G1BS6AgUUrph9RSGkt"
      );
      expect(accounts.from.toString()).to.equal(
        "DvQ3j1JB9D4VnejZuyZ2jfVpuHzgRsFjUxeTPg6bH35R"
      );
      expect(accounts.mint.toString()).to.equal(
        "So11111111111111111111111111111111111111112"
      );
      expect(accounts.splMetadata.toString()).to.equal(
        "6dM4TqWyWJsbx7obrdLcviBkTafD5E8av61zfU6jq57X"
      );
      expect(accounts.custody.toString()).to.equal(
        "23umKjJUsze7y3dEtzokgLfjbmf6QBzJZF32aM8b7tv4"
      );
      expect(accounts.authoritySigner.toString()).to.equal(
        "8wQntfMPFsuMAWKD7yzjhwvkaqzLpFuhkTzZBhHSNgqe"
      );
      expect(accounts.custodySigner.toString()).to.equal(
        "J62hXP1481E4FZEEURzkqi1t79hekbyC65wSM8SMyr4B"
      );
      expect(accounts.wormholeConfig.toString()).to.equal(
        "FKoMTctsC7vJbEqyRiiPskPnuQx2tX1kurmvWByq5uZP"
      );
      expect(accounts.wormholeMessage.equals(message.publicKey)).to.be.true;
      expect(accounts.wormholeEmitter.toString()).to.equal(
        "BABAnMBgBELTQnHabZqYa1thHKp834RDvud4rJ8EUr3k"
      );
      expect(accounts.wormholeSequence.toString()).to.equal(
        "22XFuf8jDbVdmqVoTcGkBu8nWDV7e7s3219CQXNFDhzk"
      );
      expect(accounts.wormholeFeeCollector.toString()).to.equal(
        "GXBsgBD3LDn3vkRZF6TfY5RqgajVZ4W5bMAdiAaaUARs"
      );
      expect(accounts.clock.equals(web3.SYSVAR_CLOCK_PUBKEY)).to.be.true;
      expect(accounts.rent.equals(web3.SYSVAR_RENT_PUBKEY)).to.be.true;
      expect(accounts.systemProgram.equals(web3.SystemProgram.programId)).to.be
        .true;
      expect(accounts.tokenProgram.equals(TOKEN_PROGRAM_ID)).to.be.true;
      expect(
        accounts.splMetadataProgram.equals(SplTokenMetadataProgram.programId)
      ).to.be.true;
      expect(accounts.wormholeProgram.equals(CORE_BRIDGE_ADDRESS)).to.be.true;
    });

    it("Instruction 6: Register Chain", () => {
      const timestamp = 45678901;
      const message = governance.publishRegisterChain(
        timestamp,
        2,
        ETHEREUM_NFT_BRIDGE_ADDRESS
      );
      const signedVaa = guardians.addSignatures(
        message,
        [0, 1, 2, 3, 5, 7, 8, 9, 10, 12, 15, 16, 18]
      );

      const accounts = getRegisterChainAccounts(
        NFT_BRIDGE_ADDRESS,
        CORE_BRIDGE_ADDRESS,
        payer,
        signedVaa
      );

      // verify accounts
      expect(accounts.config.toString()).to.equal(
        "FEBC3gqEA3bto28QpBaJiw3zB2G1BS6AgUUrph9RSGkt"
      );
      expect(accounts.endpoint.toString()).to.equal(
        "8bb1dHmy8BqoSr43H2Wcko8cvE2kDQXuB7zQ8dJhpRLh"
      );
      expect(accounts.vaa.toString()).to.equal(
        "AThwLCjVtpAcu3FSJVZ71BiBERapzoTYZ3jeW3A1aEqj"
      );
      expect(accounts.claim.toString()).to.equal(
        "3JEgbaFri5yB46vedEchUSuQNPFqxoAGY3WzzVgdmjA3"
      );
      expect(accounts.rent.equals(web3.SYSVAR_RENT_PUBKEY)).to.be.true;
      expect(accounts.systemProgram.equals(web3.SystemProgram.programId)).to.be
        .true;
      expect(accounts.wormholeProgram.equals(CORE_BRIDGE_ADDRESS)).to.be.true;
    });

    it("Instruction 7: Upgrade Contract", () => {
      const timestamp = 56789012;
      // TODO
    });
  });

  describe("NFT Bridge Program Interaction", () => {
    // for generating governance wormhole messages
    const governance = new NftBridgeGovernanceEmitter(
      GOVERNANCE_EMITTER_ADDRESS.toBuffer().toString("hex")
    );

    // nft bridge on Ethereum
    const ethereumNftBridge = new MockEthereumNftBridge(
      ETHEREUM_NFT_BRIDGE_ADDRESS
    );

    describe("Setup NFT Bridge", () => {
      it("Initialize", async () => {
        const initializeTx = await web3.sendAndConfirmTransaction(
          connection,
          new web3.Transaction().add(
            createInitializeInstruction(
              NFT_BRIDGE_ADDRESS,
              wallet.key(),
              CORE_BRIDGE_ADDRESS
            )
          ),
          [wallet.signer()]
        );
        // console.log(`initializeTx: ${initializeTx}`);

        // verify data
        const config = await getNftBridgeConfig(connection, NFT_BRIDGE_ADDRESS);
        expect(config.wormhole.equals(CORE_BRIDGE_ADDRESS)).to.be.true;
      });

      it("Register Ethereum NFT Bridge", async () => {
        const timestamp = now();
        const message = governance.publishRegisterChain(
          timestamp,
          2,
          ETHEREUM_NFT_BRIDGE_ADDRESS
        );
        const signedVaa = guardians.addSignatures(
          message,
          [0, 1, 2, 3, 5, 7, 8, 9, 10, 12, 15, 16, 18]
        );

        const txSignatures = await postVaa(
          connection,
          wallet.signTransaction,
          CORE_BRIDGE_ADDRESS,
          wallet.key(),
          signedVaa
        ).then((results) => results.map((result) => result.signature));
        const postTx = txSignatures.pop()!;
        for (const verifyTx of txSignatures) {
          // console.log(`verifySignatures: ${verifyTx}`);
        }
        // console.log(`postVaa:          ${postTx}`);

        const registerChainTx = await web3.sendAndConfirmTransaction(
          connection,
          new web3.Transaction().add(
            createRegisterChainInstruction(
              NFT_BRIDGE_ADDRESS,
              CORE_BRIDGE_ADDRESS,
              wallet.key(),
              signedVaa
            )
          ),
          [wallet.signer()]
        );
        // console.log(`registerChainTx: ${registerChainTx}`);

        // verify data
        const parsed = parseNftBridgeRegisterChainVaa(signedVaa);
        const endpoint = deriveEndpointKey(
          NFT_BRIDGE_ADDRESS,
          parsed.foreignChain,
          parsed.foreignAddress
        );
        const endpointRegistration = await getEndpointRegistration(
          connection,
          endpoint
        );
        expect(endpointRegistration.chain).to.equal(2);
        const expectedEmitter = ethAddressToBuffer(ETHEREUM_NFT_BRIDGE_ADDRESS);
        expect(
          Buffer.compare(endpointRegistration.contract, expectedEmitter)
        ).to.equal(0);
      });
    });

    describe("Native Token Handling", () => {
      it("Send NFT", async () => {
        const mint = localVariables.mint;
        const mintAta = localVariables.mintAta;
        const custodyAccount = deriveCustodyKey(NFT_BRIDGE_ADDRESS, mint);
        const walletBalanceBefore = await getAccount(connection, mintAta).then(
          (account) => account.amount
        );
        const custodyBalanceBefore = 0n;
        const nonce = 69;
        const targetAddress = Buffer.alloc(32, "deadbeef", "hex");
        const targetChain = 2;

        const approveIx = createApproveAuthoritySignerInstruction(
          NFT_BRIDGE_ADDRESS,
          mintAta,
          wallet.key()
        );

        const message = web3.Keypair.generate();
        const transferNativeIx = createTransferNativeInstruction(
          NFT_BRIDGE_ADDRESS,
          CORE_BRIDGE_ADDRESS,
          wallet.key(),
          message.publicKey,
          mintAta,
          mint,
          nonce,
          targetAddress,
          targetChain
        );

        const approveAndTransferTx = await web3.sendAndConfirmTransaction(
          connection,
          new web3.Transaction().add(approveIx, transferNativeIx),
          [wallet.signer(), message]
        );
        // console.log(`approveAndTransferTx: ${approveAndTransferTx}`);

        const walletBalanceAfter = await getAccount(connection, mintAta).then(
          (account) => account.amount
        );
        const custodyBalanceAfter = await getAccount(
          connection,
          custodyAccount
        ).then((account) => account.amount);

        // check balance changes
        expect(walletBalanceBefore - walletBalanceAfter).to.equal(1n);
        expect(custodyBalanceAfter - custodyBalanceBefore).to.equal(1n);

        // verify data
        const messageData = await getPostedMessage(
          connection,
          message.publicKey
        ).then((posted) => posted.message);
        expect(messageData.consistencyLevel).to.equal(32);
        expect(
          Buffer.compare(
            messageData.emitterAddress,
            deriveWormholeEmitterKey(NFT_BRIDGE_ADDRESS).toBuffer()
          )
        ).to.equal(0);
        expect(messageData.emitterChain).to.equal(1);
        expect(messageData.nonce).to.equal(nonce);
        expect(messageData.sequence).to.equal(0n);
        expect(messageData.vaaTime).to.equal(0);
        expect(messageData.vaaSignatureAccount.equals(web3.PublicKey.default))
          .to.be.true;
        expect(messageData.vaaVersion).to.equal(0);

        const nftTransfer = parseNftTransferPayload(messageData.payload);
        const nftMeta = localVariables.nftMeta;
        expect(nftTransfer.payloadType).to.equal(1);
        expect(
          Buffer.compare(nftTransfer.tokenAddress, Buffer.alloc(32, 1))
        ).to.equal(0);
        expect(nftTransfer.tokenChain).to.equal(1);
        expect(nftTransfer.name).to.equal(nftMeta.name);
        expect(nftTransfer.symbol).to.equal(nftMeta.symbol);
        expect(nftTransfer.tokenId).to.equal(
          BigInt(new BN(mint.toBuffer()).toString())
        );
        const expectedUri = Buffer.alloc(200);
        expectedUri.write(nftMeta.uri, 0);
        expect(nftTransfer.uri).to.equal(expectedUri.toString());
        expect(Buffer.compare(nftTransfer.to, targetAddress)).to.equal(0);
        expect(nftTransfer.toChain).to.equal(targetChain);
      });

      it("Receive NFT", async () => {
        //   const mint = localVariables.mint;
        //   const mintAta = localVariables.mintAta;
        //   const custodyAccount = deriveCustodyKey(NFT_BRIDGE_ADDRESS, mint);
        //   const walletBalanceBefore = await getAccount(connection, mintAta).then(
        //     (account) => account.amount
        //   );
        //   const custodyBalanceBefore = await getAccount(
        //     connection,
        //     custodyAccount
        //   ).then((account) => account.amount);
        //   const amount = 420n * BigInt(web3.LAMPORTS_PER_SOL);
        //   const mintInfo = await getMint(connection, mint);
        //   expect(mintInfo.decimals).greaterThan(8);
        //   // decimals will be 8 on Ethereum token bridge
        //   const amountEncoded =
        //     amount / BigInt(Math.pow(10, mintInfo.decimals - 8));
        //   const tokenChain = 1;
        //   const recipientChain = 1;
        //   const fee = 0n;
        //   const nonce = 420;
        //   const message = ethereumTokenBridge.publishTransferTokens(
        //     mint.toBuffer().toString("hex"),
        //     tokenChain,
        //     amountEncoded,
        //     recipientChain,
        //     mintAta.toBuffer().toString("hex"),
        //     fee,
        //     nonce
        //   );
        //   const signedVaa = guardians.addSignatures(
        //     message,
        //     [0, 1, 2, 3, 5, 7, 8, 9, 10, 12, 15, 16, 18]
        //   );
        //   const txSignatures = await postVaa(
        //     connection,
        //     wallet.signTransaction,
        //     CORE_BRIDGE_ADDRESS,
        //     wallet.key(),
        //     signedVaa
        //   ).then((results) => results.map((result) => result.signature));
        //   const postTx = txSignatures.pop()!;
        //   for (const verifyTx of txSignatures) {
        //     // console.log(`verifySignatures: ${verifyTx}`);
        //   }
        //   // console.log(`postVaa:          ${postTx}`);
        //   const completeNativeTransferIx =
        //     createCompleteTransferNativeInstruction(
        //       NFT_BRIDGE_ADDRESS,
        //       CORE_BRIDGE_ADDRESS,
        //       wallet.key(),
        //       signedVaa
        //     );
        //   const completeNativeTransferTx = await web3.sendAndConfirmTransaction(
        //     connection,
        //     new web3.Transaction().add(completeNativeTransferIx),
        //     [wallet.signer()]
        //   );
        //   // console.log(`completeNativeTransferTx: ${completeNativeTransferTx}`);
        //   const walletBalanceAfter = await getAccount(connection, mintAta).then(
        //     (account) => account.amount
        //   );
        //   const custodyBalanceAfter = await getAccount(
        //     connection,
        //     custodyAccount
        //   ).then((account) => account.amount);
        //   // check balance changes
        //   expect(walletBalanceAfter - walletBalanceBefore).to.equal(amount);
        //   expect(custodyBalanceBefore - custodyBalanceAfter).to.equal(amount);
        //   // verify data
        //   const parsed = parseVaa(signedVaa);
        //   const messageData = await getPostedVaa(
        //     connection,
        //     CORE_BRIDGE_ADDRESS,
        //     parsed.hash
        //   ).then((posted) => posted.message);
        //   expect(messageData.consistencyLevel).to.equal(
        //     ethereumTokenBridge.consistencyLevel
        //   );
        //   expect(
        //     Buffer.compare(
        //       messageData.emitterAddress,
        //       ethAddressToBuffer(ETHEREUM_NFT_BRIDGE_ADDRESS)
        //     )
        //   ).to.equal(0);
        //   expect(messageData.emitterChain).to.equal(ethereumTokenBridge.chain);
        //   expect(messageData.nonce).to.equal(nonce);
        //   expect(messageData.sequence).to.equal(1n);
        //   expect(messageData.vaaTime).to.equal(0);
        //   expect(messageData.vaaVersion).to.equal(1);
        //   expect(
        //     Buffer.compare(parseVaa(signedVaa).payload, messageData.payload)
        //   ).to.equal(0);
        //   const nftTransfer = parseTokenTransferPayload(messageData.payload);
        //   expect(nftTransfer.payloadType).to.equal(1);
        //   expect(nftTransfer.amount).to.equal(amountEncoded);
        //   expect(nftTransfer.fee).to.equal(fee);
        //   expect(Buffer.compare(nftTransfer.to, mintAta.toBuffer())).to.equal(
        //     0
        //   );
        //   expect(nftTransfer.toChain).to.equal(recipientChain);
        //   expect(
        //     Buffer.compare(nftTransfer.tokenAddress, mint.toBuffer())
        //   ).to.equal(0);
        //   expect(nftTransfer.tokenChain).to.equal(tokenChain);
      });
    });

    describe("NFT Bridge Wrapped Token Handling", () => {
      //   it("Receive Token and Create Metadata", async () => {
      //     const tokenAddress = ethAddressToBuffer(WETH_ADDRESS);
      //     const tokenChain = ethereumTokenBridge.chain;
      //     const mint = deriveWrappedMintKey(
      //       NFT_BRIDGE_ADDRESS,
      //       tokenChain,
      //       tokenAddress
      //     );
      //     const mintAta = await getOrCreateAssociatedTokenAccount(
      //       connection,
      //       wallet.signer(),
      //       mint,
      //       wallet.key()
      //     ).then((account) => account.address);
      //     const walletBalanceBefore = await getAccount(connection, mintAta).then(
      //       (account) => account.amount
      //     );
      //     const supplyBefore = await getMint(connection, mint).then(
      //       (info) => info.supply
      //     );
      //     const amount = 2n * 4206942069n;
      //     const recipientChain = 1;
      //     const fee = 0n;
      //     const nonce = 420;
      //     const message = ethereumTokenBridge.publishTransferTokens(
      //       tokenAddress.toString("hex"),
      //       tokenChain,
      //       amount,
      //       recipientChain,
      //       mintAta.toBuffer().toString("hex"),
      //       fee,
      //       nonce
      //     );
      //     const signedVaa = guardians.addSignatures(
      //       message,
      //       [0, 1, 2, 3, 5, 7, 8, 9, 10, 12, 15, 16, 18]
      //     );
      //     const txSignatures = await postVaa(
      //       connection,
      //       wallet.signTransaction,
      //       CORE_BRIDGE_ADDRESS,
      //       wallet.key(),
      //       signedVaa
      //     ).then((results) => results.map((result) => result.signature));
      //     const postTx = txSignatures.pop()!;
      //     for (const verifyTx of txSignatures) {
      //       // console.log(`verifySignatures: ${verifyTx}`);
      //     }
      //     // console.log(`postVaa:          ${postTx}`);
      //     const completeTransferWrappedIx =
      //       createCompleteTransferWrappedInstruction(
      //         NFT_BRIDGE_ADDRESS,
      //         CORE_BRIDGE_ADDRESS,
      //         wallet.key(),
      //         signedVaa
      //       );
      //     const completeWrappedTransferTx = await web3.sendAndConfirmTransaction(
      //       connection,
      //       new web3.Transaction().add(completeTransferWrappedIx),
      //       [wallet.signer()]
      //     );
      //     // console.log(`completeWrappedTransferTx: ${completeWrappedTransferTx}`);
      //     const walletBalanceAfter = await getAccount(connection, mintAta).then(
      //       (account) => account.amount
      //     );
      //     const supplyAfter = await getMint(connection, mint).then(
      //       (info) => info.supply
      //     );
      //     // check balance and supply changes
      //     expect(walletBalanceAfter - walletBalanceBefore).to.equal(amount);
      //     expect(supplyAfter - supplyBefore).to.equal(amount);
      //     // verify data
      //     const parsed = parseVaa(signedVaa);
      //     const messageData = await getPostedVaa(
      //       connection,
      //       CORE_BRIDGE_ADDRESS,
      //       parsed.hash
      //     ).then((posted) => posted.message);
      //     expect(messageData.consistencyLevel).to.equal(
      //       ethereumTokenBridge.consistencyLevel
      //     );
      //     expect(
      //       Buffer.compare(
      //         messageData.emitterAddress,
      //         ethAddressToBuffer(ETHEREUM_NFT_BRIDGE_ADDRESS)
      //       )
      //     ).to.equal(0);
      //     expect(messageData.emitterChain).to.equal(ethereumTokenBridge.chain);
      //     expect(messageData.nonce).to.equal(nonce);
      //     expect(messageData.sequence).to.equal(3n);
      //     expect(messageData.vaaTime).to.equal(0);
      //     expect(messageData.vaaVersion).to.equal(1);
      //     expect(
      //       Buffer.compare(parseVaa(signedVaa).payload, messageData.payload)
      //     ).to.equal(0);
      //     const nftTransfer = parseTokenTransferPayload(messageData.payload);
      //     expect(nftTransfer.payloadType).to.equal(1);
      //     expect(nftTransfer.amount).to.equal(amount);
      //     expect(nftTransfer.fee).to.equal(fee);
      //     expect(Buffer.compare(nftTransfer.to, mintAta.toBuffer())).to.equal(
      //       0
      //     );
      //     expect(nftTransfer.toChain).to.equal(recipientChain);
      //     expect(
      //       Buffer.compare(nftTransfer.tokenAddress, tokenAddress)
      //     ).to.equal(0);
      //     expect(nftTransfer.tokenChain).to.equal(tokenChain);
      //   });
      //   it("Send Token", async () => {
      //     const tokenAddress = ethAddressToBuffer(WETH_ADDRESS);
      //     const tokenChain = ethereumTokenBridge.chain;
      //     const mint = deriveWrappedMintKey(
      //       NFT_BRIDGE_ADDRESS,
      //       tokenChain,
      //       tokenAddress
      //     );
      //     const mintAta = await getAssociatedTokenAddress(mint, wallet.key());
      //     const walletBalanceBefore = await getAccount(connection, mintAta).then(
      //       (account) => account.amount
      //     );
      //     const supplyBefore = await getMint(connection, mint).then(
      //       (info) => info.supply
      //     );
      //     const nonce = 69;
      //     const amount = 4206942069n;
      //     const fee = 0n;
      //     const targetAddress = Buffer.alloc(32, "deadbeef", "hex");
      //     const targetChain = 2;
      //     const approveIx = createApproveAuthoritySignerInstruction(
      //       NFT_BRIDGE_ADDRESS,
      //       mintAta,
      //       wallet.key(),
      //       amount
      //     );
      //     const message = web3.Keypair.generate();
      //     const transferNativeIx = createTransferWrappedInstruction(
      //       NFT_BRIDGE_ADDRESS,
      //       CORE_BRIDGE_ADDRESS,
      //       wallet.key(),
      //       message.publicKey,
      //       mintAta,
      //       wallet.key(),
      //       tokenChain,
      //       tokenAddress,
      //       nonce,
      //       amount,
      //       fee,
      //       targetAddress,
      //       targetChain
      //     );
      //     const approveAndTransferTx = await web3.sendAndConfirmTransaction(
      //       connection,
      //       new web3.Transaction().add(approveIx, transferNativeIx),
      //       [wallet.signer(), message]
      //     );
      //     // console.log(`approveAndTransferTx: ${approveAndTransferTx}`);
      //     const walletBalanceAfter = await getAccount(connection, mintAta).then(
      //       (account) => account.amount
      //     );
      //     const supplyAfter = await getMint(connection, mint).then(
      //       (info) => info.supply
      //     );
      //     // check balance changes
      //     expect(walletBalanceBefore - walletBalanceAfter).to.equal(amount);
      //     expect(supplyBefore - supplyAfter).to.equal(amount);
      //     // verify data
      //     const messageData = await getPostedMessage(
      //       connection,
      //       message.publicKey
      //     ).then((posted) => posted.message);
      //     expect(messageData.consistencyLevel).to.equal(32);
      //     expect(
      //       Buffer.compare(
      //         messageData.emitterAddress,
      //         deriveWormholeEmitterKey(NFT_BRIDGE_ADDRESS).toBuffer()
      //       )
      //     ).to.equal(0);
      //     expect(messageData.emitterChain).to.equal(1);
      //     expect(messageData.nonce).to.equal(nonce);
      //     expect(messageData.sequence).to.equal(3n);
      //     expect(messageData.vaaTime).to.equal(0);
      //     expect(messageData.vaaSignatureAccount.equals(web3.PublicKey.default))
      //       .to.be.true;
      //     expect(messageData.vaaVersion).to.equal(0);
      //     const nftTransfer = parseTokenTransferPayload(messageData.payload);
      //     expect(nftTransfer.payloadType).to.equal(1);
      //     const mintInfo = await getMint(connection, mint);
      //     expect(mintInfo.decimals).to.equal(8);
      //     expect(nftTransfer.amount).to.equal(amount);
      //     expect(nftTransfer.fee).to.equal(fee);
      //     expect(Buffer.compare(nftTransfer.to, targetAddress)).to.equal(0);
      //     expect(nftTransfer.toChain).to.equal(targetChain);
      //     expect(
      //       Buffer.compare(nftTransfer.tokenAddress, tokenAddress)
      //     ).to.equal(0);
      //     expect(nftTransfer.tokenChain).to.equal(tokenChain);
      //   });
    });
  });
});
