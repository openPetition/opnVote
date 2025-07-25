import { Request, Response, NextFunction } from 'express'
import { ElectionStatusService } from '../services/electionService'
import { checkElectionStatus } from './checkElectionStatus'

jest.mock('../services/electionService', () => ({
  ElectionStatusService: {
    getElectionStatus: jest.fn(),
    isElectionClosed: jest.fn(),
  },
}))

describe('checkElectionStatus Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: jest.Mock

  beforeEach(() => {
    mockReq = {
      user: { voterId: 0, electionId: 1 },
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    nextFunction = jest.fn()
  })

  it('should call next if isElectionClosed returns false', async () => {
    ;(ElectionStatusService.isElectionClosed as jest.Mock).mockReturnValue(false)

    await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('should return 403 next if isElectionClosed returns true', async () => {
    ;(ElectionStatusService.isElectionClosed as jest.Mock).mockReturnValue(true)

    await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Election is closed',
    })
  })

  it('should return 401 if user or electionId is missing', async () => {
    mockReq.user = undefined
    await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Unauthorized or missing election Id',
    })
  })
})
