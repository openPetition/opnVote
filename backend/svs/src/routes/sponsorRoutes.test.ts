import request from 'supertest'
import { app } from '../svsServer'
import { dataSource } from '../database'
import {
  EncryptedVotes,
  EncryptionType,
  RSA_BIT_LENGTH,
  Signature,
  Token,
  VotingTransaction,
  EthSignature,
} from 'votingsystem'
import { ethers } from 'ethers'

jest.mock('../middleware/checkElectionStatus', () => ({
  checkElectionStatus: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkVoterSignature', () => ({
  checkVoterSignature: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/validateParameters', () => ({
  validateParameters: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/validateBlindSignature', () => ({
  validateBlindSignature: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkVoterHasNotVoted', () => ({
  checkVoterHasNotVoted: (req: any, res: any, next: any) => next(),
}))
jest.mock('../abi/opnvote-0.2.0.json', () => [], { virtual: true })

global.fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    result: {
      standard: {
        maxFeePerGas: '0x77359400', // 2 gwei
        maxPriorityFeePerGas: '0x3B9ACA00', // 1 gwei
      },
    },
  }),
}) as jest.Mock

jest.mock('votingsystem', () => {
  const actual = jest.requireActual('votingsystem')
  return {
    ...actual,
    signPaymasterData: jest.fn().mockResolvedValue({
      paymasterData: '0xmockpaymasterdata',
    }),
    createVoteCalldata: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
  }
})

jest.mock('../database', () => ({
  dataSource: {
    initialize: jest.fn().mockResolvedValue(null),
    destroy: jest.fn().mockResolvedValue(null),
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({}),
    }),
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockImplementation(data => data),
        }),
      },
    }),
  },
}))

const EXPECTED_IMPLEMENTATION = '0x0000000000000000000000000000000000000007'

describe('POST /api/userOp/sponsor', () => {
  const dummyToken: Token = {
    hexString: '0x' + BigInt(3).toString(16).padStart(64, '0'),
    isMaster: false,
    isBlinded: false,
  }
  const dummySignature: Signature = {
    hexString: '0x' + '1'.repeat(RSA_BIT_LENGTH / 4),
    isBlinded: false,
  }
  const dummyEncryptedVotesRSA: EncryptedVotes = {
    hexString: '0x' + '1'.repeat(RSA_BIT_LENGTH / 4),
    encryptionType: EncryptionType.RSA,
  }
  const dummyEncryptedVotesAES: EncryptedVotes = {
    hexString: '0x' + '1'.repeat(80),
    encryptionType: EncryptionType.AES,
  }

  let validSvsSignature: EthSignature

  beforeAll(async () => {
    await dataSource.initialize()
    // Generate a real ECDSA signature so validateVotingTransaction accepts it
    const wallet = ethers.Wallet.createRandom()
    const sig = await wallet.signMessage('test')
    validSvsSignature = { hexString: sig }
  })

  afterAll(async () => {
    await dataSource.destroy()
    jest.clearAllMocks()
    jest.resetModules()
  })

  function createMockProvider(getCodeReturn: string = '0x') {
    return {
      getCode: jest.fn().mockResolvedValue(getCodeReturn),
      call: jest
        .fn()
        .mockResolvedValueOnce('0x') // checkVoteCall: vote() returns void
        .mockResolvedValue('0x' + '0'.repeat(64)), // getNonce: returns uint256(0)
    }
  }

  beforeEach(() => {
    app.set('SVS_SIGN_KEY', '0x0000000000000000000000000000000000000000000000000000000000000001')
    app.set('PAYMASTER_SIGNER_KEY', '0x0000000000000000000000000000000000000000000000000000000000000002')
    app.set('PAYMASTER_ADDRESS', '0x0000000000000000000000000000000000000003')
    app.set('ACCOUNT_IMPLEMENTATION_ADDRESS', EXPECTED_IMPLEMENTATION)
    app.set('MAX_SPONSOR_COUNT', 10)
    app.set('OPNVOTE_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000001')
    app.set('BUNDLER_URL', 'https://mock-bundler')
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        result: {
          standard: {
            maxFeePerGas: '0x77359400',
            maxPriorityFeePerGas: '0x3B9ACA00',
          },
        },
      }),
    })

    app.set('rpcProvider', createMockProvider())
  })

  function makeTransaction(overrides?: Partial<VotingTransaction>): VotingTransaction {
    return {
      electionID: 1,
      encryptedVoteRSA: dummyEncryptedVotesRSA,
      encryptedVoteAES: dummyEncryptedVotesAES,
      unblindedElectionToken: dummyToken,
      unblindedSignature: dummySignature,
      voterAddress: '0x1234567890123456789012345678901234567890',
      svsSignature: validSvsSignature,
      ...overrides,
    }
  }

  it('should return paymaster data and gas params for a valid transaction (fresh EOA)', async () => {
    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('paymasterData')
    expect(response.body.data.userOpParams).toEqual({
      callGasLimit: '150000',
      verificationGasLimit: '110000',
      paymasterVerificationGasLimit: '80000',
      paymasterPostOpGasLimit: '1',
      preVerificationGas: '200000',
      maxFeePerGas: '2000000000',
      maxPriorityFeePerGas: '1000000000',
      nonce: '0',
      validUntil: expect.any(Number),
      validAfter: expect.any(Number),
    })
    expect(response.body.error).toBeNull()
  })

  it('should return paymaster data when voter has correct existing delegation', async () => {
    app.set('rpcProvider', createMockProvider('0xef0100' + EXPECTED_IMPLEMENTATION.slice(2)))

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('paymasterData')
    expect(response.body.error).toBeNull()
  })

  it('should return paymaster data for a recast (no SVS signature)', async () => {
    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction({ svsSignature: null }),
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('paymasterData')
    expect(response.body.error).toBeNull()
  })

  it('should return 403 when voter has wrong 7702 delegation', async () => {
    const wrongImplementation = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    app.set('rpcProvider', createMockProvider('0xef0100' + wrongImplementation))

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      data: null,
      error: 'Invalid account delegation',
    })
  })

  it('should return 403 when voter address has regular contract code', async () => {
    app.set('rpcProvider', createMockProvider('0x6080604052'))

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      data: null,
      error: 'Invalid account delegation',
    })
  })

  it('should return 400 when voting transaction is missing', async () => {
    const response = await request(app).post('/api/userOp/sponsor').send({})

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      data: null,
      error: 'Missing voting transaction',
    })
  })

  it('should return 400 when voting transaction has invalid data', async () => {
    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction({ voterAddress: '0xinvalid' }),
      })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      data: null,
      error: 'Bad request: Invalid voting transaction data',
    })
  })

  it('should return 400 when vote simulation fails (e.g. voter already voted)', async () => {
    const mockProvider = {
      ...createMockProvider(),
      call: jest.fn().mockRejectedValue(new Error('execution reverted')),
    }
    app.set('rpcProvider', mockProvider)

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      data: null,
      error: 'Vote simulation failed',
    })
  })

  it('should return 403 when sponsor limit is exceeded', async () => {
    app.set('MAX_SPONSOR_COUNT', 2)

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({
            senderAddress: '0x1234567890123456789012345678901234567890',
            forwardCount: 2,
          }),
          save: jest.fn(),
          create: jest.fn().mockImplementation(data => data),
        }),
      },
    }

    ;(dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner)

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      data: null,
      error: 'Sponsor limit exceeded',
    })
  })

  it('should return 500 when paymaster is not configured', async () => {
    app.set('PAYMASTER_SIGNER_KEY', undefined)

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Internal server error',
    })
  })

  it('should return 500 when entrypoint is not configured', async () => {
    app.set('ENTRYPOINT_ADDRESS', undefined)

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Internal server error',
    })
  })

  it('should return 500 when account implementation is not configured', async () => {
    app.set('ACCOUNT_IMPLEMENTATION_ADDRESS', undefined)

    const response = await request(app)
      .post('/api/userOp/sponsor')
      .send({
        votingTransaction: makeTransaction(),
      })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Account implementation not configured',
    })
  })
})
