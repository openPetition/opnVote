import { Request, Response } from 'express'
import { checkEligibility } from './checkEligibility'
import { ethers } from 'ethers'
import { SignatureData } from '@gelatonetwork/relay-sdk'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'
import { validateGelatoSignature } from 'votingsystem'
jest.mock('./checkEligibility', () => jest.requireActual('./checkEligibility'))
jest.mock('votingsystem', () => ({
  validateGelatoSignature: jest.fn(),
}))

describe('checkEligibility Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: jest.Mock
  const mockContractAddress = '0x0000000000000000000000000000000000000000'
  const opnVoteInterface = new ethers.Interface(opnvoteAbi)
  const mockVoter = new ethers.Wallet(
    '0x0000000000000000000000000000000000000000000000000000000000000002',
  )
  const mockElectionId = 1
  const mockSvsSignature = '0x0000000000000000000000000000000000000000000000000000000000000002'
  const mockVoteEncryptedRSA = '0x0000000000000000000000000000000000000000000000000000000000000003'
  const mockVoteEncryptedAES = '0x0000000000000000000000000000000000000000000000000000000000000004'
  const mockUnblindedElectionToken =
    '0x0000000000000000000000000000000000000000000000000000000000000005'
  const mockUnblindedSignature =
    '0x0000000000000000000000000000000000000000000000000000000000000006'

  beforeEach(() => {
    mockReq = {
      body: {},
      app: {
        get: jest.fn().mockReturnValue(mockContractAddress),
      } as any,
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    nextFunction = jest.fn()
    ;(validateGelatoSignature as jest.Mock) = jest.fn().mockResolvedValue(true)
  })

  it('should pass when all checks are valid', () => {
    const voteData = opnVoteInterface.encodeFunctionData('vote', [
      mockElectionId,
      mockVoter.address,
      mockSvsSignature,
      mockVoteEncryptedRSA,
      mockVoteEncryptedAES,
      mockUnblindedElectionToken,
      mockUnblindedSignature,
    ])

    mockReq.body = {
      struct: {
        user: mockVoter.address,
        target: mockContractAddress,
        data: voteData,
      },
      signature: '0x1234',
    } as SignatureData

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockRes.json).not.toHaveBeenCalled()
  })

  it('should return 400 when signature data is missing', () => {
    mockReq.body = {}

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalled()
  })

  it('should return 400 when function signature is not for casting a vote', () => {
    const wrongFunctionData = opnVoteInterface
      .encodeFunctionData('vote', [
        mockElectionId,
        mockVoter.address,
        mockSvsSignature,
        mockVoteEncryptedRSA,
        mockVoteEncryptedAES,
        mockUnblindedElectionToken,
        mockUnblindedSignature,
      ])
      .replace('0x1c700694', '0xa9059cbb')

    mockReq.body = {
      struct: {
        user: mockVoter.address,
        target: mockContractAddress,
        data: wrongFunctionData,
      },
      signature: '0x1234',
    } as SignatureData

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Bad request: Invalid calldata',
    })
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should return 400 when target address is not OPNVOTE_CONTRACT_ADDRESS', () => {
    const wrongContractAddress = '0x1111111111111111111111111111111111111111'
    const voteData = opnVoteInterface.encodeFunctionData('vote', [
      //todo: update to onvote-0.0.2
      mockElectionId,
      mockVoter.address,
      mockSvsSignature,
      mockVoteEncryptedRSA,
      mockVoteEncryptedAES,
      mockUnblindedElectionToken,
      mockUnblindedSignature,
    ])

    mockReq.body = {
      struct: {
        user: mockVoter.address,
        target: wrongContractAddress,
        data: voteData,
      },
      signature: '0x1234',
    } as SignatureData

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Bad request: Wrong target address',
    })
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should return 400 when transaction sender is not the voter', () => {
    const differentSender = '0x1111111111111111111111111111111111111111'
    const voteData = opnVoteInterface.encodeFunctionData('vote', [
      //todo: update to onvote-0.0.2
      mockElectionId,
      mockVoter.address,
      mockSvsSignature,
      mockVoteEncryptedRSA,
      mockVoteEncryptedAES,
      mockUnblindedElectionToken,
      mockUnblindedSignature,
    ])

    mockReq.body = {
      struct: {
        user: differentSender,
        target: mockContractAddress,
        data: voteData,
      },
      signature: '0x1234',
    } as SignatureData

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Bad request: Signer must be voter',
    })
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should return 500 when signature validation fails', () => {
    const validateSpy = jest
      .spyOn(require('votingsystem'), 'validateGelatoSignature')
      .mockImplementation(() => {
        throw new Error('Signature validation failed')
      })

    const voteData = opnVoteInterface.encodeFunctionData('vote', [
      //todo: update to onvote-0.0.2
      mockElectionId,
      mockVoter.address,
      mockSvsSignature,
      mockVoteEncryptedRSA,
      mockVoteEncryptedAES,
      mockUnblindedElectionToken,
      mockUnblindedSignature,
    ])

    mockReq.body = {
      struct: {
        user: mockVoter.address,
        target: mockContractAddress,
        data: voteData,
      },
      signature: '0xInvalidSignature',
    } as SignatureData

    checkEligibility(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Internal server error during eligibility check',
    })
    expect(nextFunction).not.toHaveBeenCalled()

    validateSpy.mockRestore()
  })
})
