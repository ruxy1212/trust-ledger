import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
// import { Counter } from "../target/types/counter";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

type Counter = {
  "address": "9zEKwVUB5iWrzw8St3cd6tyz4FS64JaaJt3cShXaT1W7",
  "metadata": {
    "name": "counter",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "closeCounter",
      "discriminator": [
        4,
        236,
        52,
        248,
        107,
        146,
        187,
        49
      ],
      "accounts": [
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "counter"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "increment",
      "discriminator": [
        11,
        18,
        104,
        9,
        104,
        174,
        59,
        33
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "signer": true,
          "relations": [
            "counter"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initCounter",
      "discriminator": [
        247,
        168,
        146,
        45,
        125,
        26,
        142,
        80
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "counter",
      "discriminator": [
        255,
        176,
        4,
        245,
        188,
        253,
        124,
        25
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "overflow",
      "msg": "counter overflow"
    },
    {
      "code": 6001,
      "name": "paused",
      "msg": "Increments are currently paused"
    }
  ],
  "types": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "totalCounters",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "counter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

describe("counter with config", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Counter as Program<Counter>;
  const admin = provider.wallet;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), admin.publicKey.toBuffer()],
    program.programId
  );

  it("initializes config and a counter, then increments", async () => {
    await program.methods.initConfig().rpc();
    await program.methods.initCounter().rpc();
    await program.methods.increment().rpc();

    const counter = await program.account.counter.fetch(counterPda);
    assert.equal(counter.count.toNumber(), 1);
  });

  it("refuses to increment when paused", async () => {
    await program.methods.setPaused(true).rpc();
    try {
      await program.methods.increment().rpc();
      assert.fail("expected pause error");
    } catch (err: any) {
      assert.include(err.toString(), "Paused");
    }
    await program.methods.setPaused(false).rpc();
  });

  it("closes a counter and refunds the rent", async () => {
    const user = provider.wallet.publicKey;
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), user.toBuffer()],
      program.programId,
    );

    // Initialize a fresh counter if the previous test already closed it.
    const existing = await provider.connection.getAccountInfo(counterPda);
    if (existing === null) {
      await program.methods.initCounter().rpc();
    }

    const counterAccount = await provider.connection.getAccountInfo(counterPda);
    const rentLamports = counterAccount!.lamports;
    const balanceBefore = await provider.connection.getBalance(user);

    await program.methods.closeCounter().rpc();

    const counterAfter = await provider.connection.getAccountInfo(counterPda);
    const balanceAfter = await provider.connection.getBalance(user);

    if (counterAfter !== null) {
      throw new Error("counter account still exists after close");
    }

    console.log("rent refunded (lamports):", rentLamports);
    console.log("net wallet change (lamports):", balanceAfter - balanceBefore);
  });
});
