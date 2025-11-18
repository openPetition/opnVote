import { Request, Response } from 'express'
import { ElectionStatusService } from '../services/electionService'
import { checkRegistrationStatus } from './checkRegistrationStatus'

jest.mock('../services/electionService', () => ({
  ElectionStatusService: {
    getElectionStatus: jest.fn(),
    isRegistrationClosed: jest.fn(),
  },
}))

describe('checkRegistrationStatus Middleware', () => {
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

  it('should call next if isRegistrationClosed returns false', async () => {
    ;(ElectionStatusService.isRegistrationClosed as jest.Mock).mockReturnValue(false)

    await checkRegistrationStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('should return 403 if isRegistrationClosed returns true', async () => {
    ;(ElectionStatusService.isRegistrationClosed as jest.Mock).mockReturnValue(true)

    await checkRegistrationStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Registration is closed',
    })
  })

  it('should return 401 if user or electionId is missing', async () => {
    mockReq.user = undefined
    await checkRegistrationStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Unauthorized or missing election Id',
    })
  })

  it('should return 500 if getElectionStatus returns null', async () => {
    ;(ElectionStatusService.getElectionStatus as jest.Mock).mockResolvedValue(null)

    await checkRegistrationStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Failed to fetch election status',
    })
  })

  it('should return 500 if an error occurs during status check', async () => {
    ;(ElectionStatusService.getElectionStatus as jest.Mock).mockRejectedValue(
      new Error('Database error'),
    )

    await checkRegistrationStatus(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Failed to check registration status',
    })
  })
})
