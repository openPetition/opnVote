import { Request, Response } from 'express'
import { checkEthCall } from './checkEthCall'
import { ethers } from 'ethers'
import { SignatureData } from '@gelatonetwork/relay-sdk'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'

describe('checkEthCall Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: jest.Mock
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>

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
    mockProvider = {
      call: jest.fn(),
    } as any

    mockReq = {
      body: {},
      app: {
        get: jest.fn().mockReturnValue(mockProvider),
      } as any,
    }

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    nextFunction = jest.fn()
  })

  it('should pass when eth_call returns 0x', async () => {
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

    mockProvider.call.mockResolvedValueOnce('0x')

    await checkEthCall(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockProvider.call).toHaveBeenCalledWith({
      to: mockContractAddress,
      data: voteData,
      from: mockVoter.address,
    })
    expect(nextFunction).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockRes.json).not.toHaveBeenCalled()
  })

  it('should return 400 when eth_call returns non-zero value', async () => {
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
      signature: '0x1234',
    } as SignatureData

    mockProvider.call.mockResolvedValueOnce('0x1234')

    await checkEthCall(mockReq as Request, mockRes as Response, nextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalled()
  })
})
