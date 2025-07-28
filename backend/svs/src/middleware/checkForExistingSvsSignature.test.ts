import { Request, Response } from 'express'
import { checkForExistingSvsSignature } from './checkForExistingSvsSignature'
import { dataSource } from '../database'
import { EthSignature, VotingTransaction, Token, EncryptionType } from 'votingsystem'
import { logger } from '../utils/logger'

jest.mock('../database')
jest.mock('../models/VotingTransaction')

describe('checkForExistingSvsSignature Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: jest.Mock
  let mockRepository: any

  beforeEach(() => {
    mockReq = {
      body: {},
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    nextFunction = jest.fn()
    mockRepository = {
      findOne: jest.fn(),
    }
    ;(dataSource.getRepository as jest.Mock).mockReturnValue(mockRepository)
    ;(logger.error as jest.Mock) = jest.fn()
    ;(logger.info as jest.Mock) = jest.fn()
    ;(logger.warn as jest.Mock) = jest.fn()
  })

  it('should return 200 with existing signature if found', async () => {
    const mockVotingTransaction: VotingTransaction = {
      electionID: 1,
      voterAddress: '0x1234567890123456789012345678901234567890',
      encryptedVoteRSA: { hexString: '0x1234', encryptionType: EncryptionType.RSA },
      encryptedVoteAES: { hexString: '0xabcd', encryptionType: EncryptionType.AES },
      unblindedElectionToken: { hexString: '0xabcd' } as Token,
      unblindedSignature: {
        hexString: '0xef01',
        isBlinded: false,
      },
      svsSignature: null,
    }
    const mockVoterSignature: EthSignature = { hexString: '0x2345' }
    mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature }

    const mockExistingTransaction = {
      svsSignature:
        '0xd4810d1ba4c299209b9b98c5623efdcbff269bb91d40247355e81ae087c32fb55ce42815ff163f61589886233542b4b95a65fb7d4235cc827e7a09e4d97e3f3f1b',
    }
    mockRepository.findOne.mockResolvedValue(mockExistingTransaction)

    await checkForExistingSvsSignature(mockReq as Request, mockRes as Response, nextFunction)

    const mockResBlindedSignature: EthSignature = {
      hexString:
        '0xd4810d1ba4c299209b9b98c5623efdcbff269bb91d40247355e81ae087c32fb55ce42815ff163f61589886233542b4b95a65fb7d4235cc827e7a09e4d97e3f3f1b',
    }

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: {
        message: 'Existing SVS signature found.',
        blindedSignature: mockResBlindedSignature,
      },
      error: null,
    })
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should call next() if no existing signature is found', async () => {
    const mockVotingTransaction: VotingTransaction = {
      electionID: 1,
      voterAddress: '0x1234567890123456789012345678901234567890',
      encryptedVoteRSA: { hexString: '0x1234', encryptionType: EncryptionType.RSA },
      encryptedVoteAES: { hexString: '0xabcd', encryptionType: EncryptionType.AES },
      unblindedElectionToken: { hexString: '0xabcd' } as Token,
      unblindedSignature: {
        hexString: '0xef01',
        isBlinded: false,
      },
      svsSignature: null,
    }
    const mockVoterSignature: EthSignature = { hexString: '0x2345' }
    mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature }

    mockRepository.findOne.mockResolvedValue(null)

    await checkForExistingSvsSignature(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockRes.json).not.toHaveBeenCalled()
    expect(nextFunction).toHaveBeenCalled()
  })

  it('should return 500 if there is a database error', async () => {
    const mockVotingTransaction: VotingTransaction = {
      electionID: 1,
      voterAddress: '0x1234567890123456789012345678901234567890',
      encryptedVoteRSA: { hexString: '0x1234', encryptionType: EncryptionType.RSA },
      encryptedVoteAES: { hexString: '0xabcd', encryptionType: EncryptionType.AES },
      unblindedElectionToken: { hexString: '0xabcd' } as Token,
      unblindedSignature: {
        hexString: '0xef01',
        isBlinded: false,
      },
      svsSignature: null,
    }
    const mockVoterSignature: EthSignature = { hexString: '0x2345' }
    mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature }

    const dbError = new Error('Database error')
    mockRepository.findOne.mockRejectedValue(dbError)

    await checkForExistingSvsSignature(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Internal server error',
    })
    expect(nextFunction).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledTimes(1)
    const loggedMessage = (logger.error as jest.Mock).mock.calls[0][0]
    expect(loggedMessage).toContain('[ExistingSVS] Error checking for existing SVS signature after')
    expect(loggedMessage).toContain('Error: Database error')
  })
})
