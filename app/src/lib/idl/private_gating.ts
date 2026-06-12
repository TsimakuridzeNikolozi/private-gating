/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/private_gating.json`.
 */
export type PrivateGating = {
  address: "HHvAWv65zH5gXBj6qdHQE1YJ3R9KE8wvtkX7pSwoViwZ";
  metadata: {
    name: "privateGating";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claimPrize";
      docs: [
        "Claim the prize by proving knowledge of the secret behind the winning",
        "nullifier; the recipient is bound inside the proof.",
      ];
      discriminator: [157, 233, 139, 121, 246, 62, 234, 235];
      accounts: [
        {
          name: "gate";
          writable: true;
        },
        {
          name: "recipient";
          writable: true;
        },
        {
          name: "payer";
          docs: ["The relayer — pays the fee only."];
          signer: true;
        },
      ];
      args: [
        {
          name: "proof";
          type: {
            array: ["u8", 256];
          };
        },
        {
          name: "publicSignals";
          type: {
            array: [
              {
                array: ["u8", 32];
              },
              4,
            ];
          };
        },
      ];
    },
    {
      name: "createGate";
      discriminator: [32, 40, 167, 136, 81, 13, 199, 238];
      accounts: [
        {
          name: "gate";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 116, 101];
              },
              {
                kind: "account";
                path: "operator";
              },
              {
                kind: "arg";
                path: "labelHash";
              },
            ];
          };
        },
        {
          name: "operator";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "labelHash";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "label";
          type: "string";
        },
        {
          name: "gateType";
          type: {
            defined: {
              name: "gateType";
            };
          };
        },
        {
          name: "target";
          type: "pubkey";
        },
        {
          name: "threshold";
          type: "u64";
        },
      ];
    },
    {
      name: "drawWinner";
      docs: ["Operator selects a winning entry from the consumed nullifiers."];
      discriminator: [250, 103, 118, 147, 219, 235, 169, 220];
      accounts: [
        {
          name: "gate";
          writable: true;
        },
        {
          name: "operator";
          signer: true;
          relations: ["gate"];
        },
        {
          name: "winner";
          docs: [
            "Proof that this nullifier was actually consumed on this gate.",
          ];
        },
      ];
      args: [];
    },
    {
      name: "publishRoot";
      docs: ["Publish the snapshot's Merkle root; the gate becomes live."];
      discriminator: [50, 189, 35, 212, 180, 100, 87, 25];
      accounts: [
        {
          name: "gate";
          writable: true;
        },
        {
          name: "operator";
          signer: true;
          relations: ["gate"];
        },
      ];
      args: [
        {
          name: "root";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "memberCount";
          type: "u32";
        },
      ];
    },
    {
      name: "verifyAndPass";
      docs: [
        "Verify a gate proof and consume its nullifier. The only signer is the",
        "relayer (fee payer); the proof itself is the authorization.",
      ];
      discriminator: [46, 204, 180, 101, 190, 155, 215, 69];
      accounts: [
        {
          name: "gate";
          writable: true;
        },
        {
          name: "nullifierRecord";
          docs: [
            "Replay protection: seeded by the proof's own nullifier signal (the",
            "handler requires nullifier == public_signals[SIG_NULLIFIER]).",
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [110, 117, 108, 108, 105, 102, 105, 101, 114];
              },
              {
                kind: "account";
                path: "gate";
              },
              {
                kind: "arg";
                path: "nullifier";
              },
            ];
          };
        },
        {
          name: "payer";
          docs: [
            "The relayer — pays fees and rent; carries no authorization meaning.",
          ];
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "nullifier";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "proof";
          type: {
            array: ["u8", 256];
          };
        },
        {
          name: "publicSignals";
          type: {
            array: [
              {
                array: ["u8", 32];
              },
              4,
            ];
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "gate";
      discriminator: [13, 25, 212, 153, 150, 57, 225, 171];
    },
    {
      name: "nullifierRecord";
      discriminator: [56, 18, 57, 175, 69, 202, 189, 70];
    },
  ];
  events: [
    {
      name: "passed";
      discriminator: [119, 108, 155, 248, 118, 13, 176, 41];
    },
    {
      name: "prizeClaimed";
      discriminator: [213, 150, 192, 76, 199, 33, 212, 38];
    },
    {
      name: "rootPublished";
      discriminator: [231, 234, 14, 142, 140, 65, 122, 203];
    },
    {
      name: "winnerDrawn";
      discriminator: [213, 103, 5, 118, 145, 75, 146, 120];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "labelTooLong";
      msg: "label exceeds 64 bytes";
    },
    {
      code: 6001;
      name: "labelHashMismatch";
      msg: "label hash does not match label";
    },
    {
      code: 6002;
      name: "nullifierSeedMismatch";
      msg: "nullifier seed does not match proof signal";
    },
    {
      code: 6003;
      name: "zeroThreshold";
      msg: "threshold must be positive";
    },
    {
      code: 6004;
      name: "invalidFieldElement";
      msg: "value is not a canonical BN254 field element";
    },
    {
      code: 6005;
      name: "gateNotLive";
      msg: "gate has no published snapshot root";
    },
    {
      code: 6006;
      name: "rootMismatch";
      msg: "proof root does not match the published snapshot root";
    },
    {
      code: 6007;
      name: "thresholdMismatch";
      msg: "proof threshold does not match the gate threshold";
    },
    {
      code: 6008;
      name: "gateIdMismatch";
      msg: "proof is bound to a different gate";
    },
    {
      code: 6009;
      name: "invalidProof";
      msg: "zero-knowledge proof verification failed";
    },
    {
      code: 6010;
      name: "winnerNotFromGate";
      msg: "nullifier record does not belong to this gate";
    },
    {
      code: 6011;
      name: "notWinningNullifier";
      msg: "nullifier is not the drawn winner";
    },
    {
      code: 6012;
      name: "recipientMismatch";
      msg: "recipient does not match the proof binding";
    },
    {
      code: 6013;
      name: "prizeAlreadyClaimed";
      msg: "prize already claimed";
    },
    {
      code: 6014;
      name: "prizePotEmpty";
      msg: "prize pot is empty; fund the gate before claiming";
    },
  ];
  types: [
    {
      name: "gate";
      type: {
        kind: "struct";
        fields: [
          {
            name: "operator";
            type: "pubkey";
          },
          {
            name: "label";
            type: "string";
          },
          {
            name: "gateType";
            type: {
              defined: {
                name: "gateType";
              };
            };
          },
          {
            name: "target";
            type: "pubkey";
          },
          {
            name: "threshold";
            type: "u64";
          },
          {
            name: "merkleRoot";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "memberCount";
            type: "u32";
          },
          {
            name: "snapshotTs";
            type: "i64";
          },
          {
            name: "passCount";
            type: "u64";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "gateStatus";
              };
            };
          },
          {
            name: "winningNullifier";
            type: {
              option: {
                array: ["u8", 32];
              };
            };
          },
          {
            name: "prizeClaimed";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "gateStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "registering";
          },
          {
            name: "live";
          },
        ];
      };
    },
    {
      name: "gateType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "tokenBalance";
          },
          {
            name: "nftCollection";
          },
          {
            name: "sybilAction";
          },
        ];
      };
    },
    {
      name: "nullifierRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gate";
            type: "pubkey";
          },
          {
            name: "nullifier";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
    {
      name: "passed";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gate";
            type: "pubkey";
          },
          {
            name: "nullifier";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "passCount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "prizeClaimed";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gate";
            type: "pubkey";
          },
          {
            name: "nullifier";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "lamports";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "rootPublished";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gate";
            type: "pubkey";
          },
          {
            name: "root";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "memberCount";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "winnerDrawn";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gate";
            type: "pubkey";
          },
          {
            name: "nullifier";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
  ];
};
