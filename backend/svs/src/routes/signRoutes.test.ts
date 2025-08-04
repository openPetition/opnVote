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
  normalizeHexString,
} from 'votingsystem'
import { ethers } from 'ethers'

jest.mock('../middleware/checkVoterSignature', () => ({
  checkVoterSignature: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/validateParameters', () => ({
  validateParameters: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkElectionStatus', () => ({
  checkElectionStatus: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/validateBlindSignature', () => ({
  validateBlindSignature: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkVoterHasNotVoted', () => ({
  checkVoterHasNotVoted: (req: any, res: any, next: any) => next(),
}))
jest.mock('../workers/gelatoWorker', () => ({
  startGelatoWorker: jest.fn(),
}))

jest.mock('../database', () => ({
  dataSource: {
    initialize: jest.fn().mockResolvedValue(null),
    destroy: jest.fn().mockResolvedValue(null),
    getRepository: jest.fn().mockReturnValue({
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

describe('POST /api/votingTransaction/sign', () => {
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

  const mockVotingTransaction: VotingTransaction = {
    electionID: 1,
    encryptedVoteRSA: dummyEncryptedVotesRSA,
    encryptedVoteAES: dummyEncryptedVotesAES,
    unblindedElectionToken: dummyToken,
    unblindedSignature: dummySignature,
    voterAddress: '0x1234567890123456789012345678901234567890',
    svsSignature: null,
  }

  beforeAll(async () => {
    await dataSource.initialize()
  })

  afterAll(async () => {
    await dataSource.destroy()
    jest.clearAllMocks()
    jest.resetModules()
  })

  beforeEach(() => {
    app.set('SVS_SIGN_KEY', '0x0000000000000000000000000000000000000000000000000000000000000001')
    jest.clearAllMocks()
  })

  it('should successfully sign a voting transaction', async () => {
    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: mockVotingTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: {
        blindedSignature: expect.any(Object),
      },
      error: null,
    })
    expect(response.body.data.blindedSignature).toHaveProperty('hexString')
  })

  it('should return 401 when voting transaction is missing', async () => {
    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      data: null,
      error: 'Unauthorized',
    })
  })

  it('should return 500 when signing key is not configured', async () => {
    app.set('SVS_SIGN_KEY', undefined)

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: mockVotingTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Signing key not configured',
    })
  })

  it('should handle database errors gracefully', async () => {
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockRejectedValueOnce(new Error('Database error')),
          create: jest.fn().mockImplementation(data => data),
        }),
      },
    }

    ;(dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner)

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: mockVotingTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Internal server error',
    })
  })

  it('should store normalized addresses', async () => {
    const saveMock = jest.fn().mockResolvedValueOnce({})
    const createMock = jest.fn().mockImplementation(data => data)

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
          save: saveMock,
          create: createMock,
        }),
      },
    }

    ;(dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner)

    const mixedCaseTransaction = {
      ...mockVotingTransaction,
      voterAddress: '0xAB34567890123456789012345678901234567890',
    }

    await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: mixedCaseTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        voterAddress: ethers.getAddress(mixedCaseTransaction.voterAddress.toLowerCase()),
      }),
    )
  })

  it('should return 500 when transaction contains invalid hex strings', async () => {
    // The same validation applies to unblindedSignature
    const invalidTransaction = {
      ...mockVotingTransaction,
      unblindedElectionToken: {
        hexString: '0x00AB' + BigInt(3).toString(16).padStart(60, '0'),
        isMaster: false,
        isBlinded: false,
      },
    }

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: invalidTransaction,
        voterSignature: { hexString: '0xsignature' },
      })
    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: 'Internal server error',
    })
  })

  it('should accept valid lowercase hex strings', async () => {
    const validTransaction = {
      ...mockVotingTransaction,
      unblindedElectionToken: {
        hexString: '0x00ab' + BigInt(3).toString(16).padStart(60, '0'),
        isMaster: false,
        isBlinded: false,
      },
    }

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: validTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('blindedSignature')
  })

  it('should allow updates to existing unblindedElectionToken + electionID combination', async () => {
    const findOneMock = jest.fn().mockResolvedValue({
      id: 1,
      electionId: 1,
      voterAddress: ethers.getAddress(mockVotingTransaction.voterAddress.toLowerCase()),
      unblindedElectionToken: normalizeHexString(
        mockVotingTransaction.unblindedElectionToken.hexString.toLowerCase(),
      ),
      unblindedSignature: normalizeHexString(
        mockVotingTransaction.unblindedSignature.hexString.toLowerCase(),
      ),
      encryptedVoteRsa: '0x' + '3'.repeat(RSA_BIT_LENGTH / 4),
      encryptedVoteAes: '0x' + '3'.repeat(80),
      svsSignature: 'old_signature',
    })

    const saveMock = jest.fn().mockResolvedValue({})

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: findOneMock,
          save: saveMock,
          create: jest.fn(),
        }),
      },
    }

    ;(dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner)

    const updatedTransaction = {
      ...mockVotingTransaction,
      encryptedVoteRSA: {
        hexString: '0x' + '2'.repeat(RSA_BIT_LENGTH / 4),
        encryptionType: EncryptionType.RSA,
      },
      encryptedVoteAES: {
        hexString: '0x' + '2'.repeat(80),
        encryptionType: EncryptionType.AES,
      },
    }

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: updatedTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(200)
    expect(findOneMock).toHaveBeenCalledWith({
      where: {
        unblindedElectionToken: normalizeHexString(
          mockVotingTransaction.unblindedElectionToken.hexString.toLowerCase(),
        ),
        electionId: 1,
      },
      lock: { mode: 'pessimistic_write' },
    })
    expect(saveMock).toHaveBeenCalled()
  })

  it('should prevent voter address change for existing unblindedElectionToken', async () => {
    const findOneMock = jest.fn().mockResolvedValue({
      id: 1,
      electionId: 1,
      voterAddress: '0x9999567890123456789012345678901234567890',
      unblindedElectionToken: normalizeHexString(
        mockVotingTransaction.unblindedElectionToken.hexString.toLowerCase(),
      ),
      unblindedSignature: normalizeHexString(
        mockVotingTransaction.unblindedSignature.hexString.toLowerCase(),
      ),
    })

    const rollbackMock = jest.fn()

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: rollbackMock,
      release: jest.fn(),
      isTransactionActive: true,
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: findOneMock,
          save: jest.fn(),
          create: jest.fn(),
        }),
      },
    }

    ;(dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner)

    const response = await request(app)
      .post('/api/votingTransaction/sign')
      .send({
        votingTransaction: mockVotingTransaction,
        voterSignature: { hexString: '0xsignature' },
      })

    expect(response.status).toBe(500)
    expect(rollbackMock).toHaveBeenCalled()
  })
})
