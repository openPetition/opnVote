import jwt from 'jsonwebtoken'
import authenticateJwt from './authenticateJwt'
import { Request, Response, Application } from 'express'

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}))

describe('authenticateJwt Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: jest.Mock

  beforeEach(() => {
    mockReq = {
      headers: {
        authorization: 'Bearer fakeToken123',
      },
      app: {
        get: jest.fn(() => 'mockPublicKey'),
      } as unknown as Partial<Application> as Application,
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    nextFunction = jest.fn()
  })

  it('should call next if token is valid', () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ voterId: 1, electionId: 1 })
    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)
    expect(nextFunction).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('should call next and set user if token is valid', () => {
    const userData = { voterId: 1, electionId: 1 }
    ;(jwt.verify as jest.Mock).mockReturnValue(userData)
    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
    expect(mockReq.user).toEqual(userData)
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('should return 401 if the authorization header is missing', () => {
    mockReq.headers!.authorization = ''

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Authorization header must be Bearer [token]',
    })
  })

  it('should return 401 if the authorization header is not in the correct format', () => {
    mockReq.headers!.authorization = 'WrongFormatToken123'

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Authorization header must be Bearer [token]',
    })
  })

  it('should return 403 if the token is invalid', () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token')
    })

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Failed to authenticate Jwt',
    })
  })

  it('should return 403 if voterId in Jwt payload is not positive numbers', () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ voterId: -1, electionId: 0 })

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Failed to authenticate Jwt',
    })
  })

  it('should return 403 if electionId in Jwt payload is not positive numbers', () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ voterId: 0, electionId: -1 })

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Failed to authenticate Jwt',
    })
  })

  it('should return 403 if voterId or electionId in Jwt payload is not positive numbers', () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ voterId: '0', electionId: -1 })

    authenticateJwt(mockReq as Request, mockRes as Response, nextFunction)

    expect(nextFunction).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      data: null,
      error: 'Failed to authenticate Jwt',
    })
  })
})
