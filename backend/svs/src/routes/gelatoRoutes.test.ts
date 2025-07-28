import request from 'supertest'
import { app } from '../svsServer'
import { dataSource } from '../database'
import { GelatoRelay } from '@gelatonetwork/relay-sdk'

jest.mock('../middleware/checkEligibility', () => ({
  checkEligibility: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkEthCall', () => ({
  checkEthCall: (req: any, res: any, next: any) => next(),
}))
jest.mock('../middleware/checkForwardLimit', () => ({
  checkForwardLimit: (req: any, res: any, next: any) => next(),
}))
jest.mock('../workers/gelatoWorker', () => ({
  startGelatoWorker: jest.fn(),
}))
jest.mock('../database', () => ({
  dataSource: {
    initialize: jest.fn().mockResolvedValue(null),
    destroy: jest.fn().mockResolvedValue(null),
    getRepository: jest.fn().mockReturnValue({
      save: jest.fn().mockResolvedValue({ requestHash: 'mock-hash' }),
      findOne: jest.fn().mockResolvedValue(null),
    }),
  },
}))
jest.mock('@gelatonetwork/relay-sdk', () => {
  const sponsoredCall = jest.fn()
  const GelatoRelay = jest.fn().mockImplementation(() => ({
    sponsoredCallERC2771WithSignature: sponsoredCall,
  }))

  ;(GelatoRelay as any).mockSponsoredCall = sponsoredCall

  return {
    GelatoRelay,
    __esModule: true,
  }
})

const mockSponsoredCall = (GelatoRelay as any).mockSponsoredCall

describe('POST /api/gelato/forward', () => {
  const mockSignatureData = {
    struct: {
      user: '0x1234567890123456789012345678901234567890',
      target: '0x1234567890123456789012345678901234567890',
      data: '0x1c7006941234567890',
    },
    signature: '0xabcd1234',
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
    app.set('GELATO_USE_QUEUE', true)
    app.set('OPNVOTE_CONTRACT_ADDRESS', mockSignatureData.struct.target)
    jest.clearAllMocks()
  })

  it('should queue request when GELATO_USE_QUEUE is true', async () => {
    const response = await request(app).post('/api/gelato/forward').send(mockSignatureData)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: { requestHash: expect.any(String) },
      error: null,
    })
  })

  it('should forward to Gelato when GELATO_USE_QUEUE is false', async () => {
    app.set('GELATO_USE_QUEUE', false)
    app.set('GELATO_SPONSOR_API_KEY', 'test-key')

    const mockTaskId = '0x1234567890123456789012345678901234567890'
    mockSponsoredCall.mockResolvedValueOnce({ taskId: mockTaskId })

    const response = await request(app).post('/api/gelato/forward').send(mockSignatureData)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: { taskId: mockTaskId },
      error: null,
    })
    expect(mockSponsoredCall).toHaveBeenCalledTimes(1)
    expect(mockSponsoredCall).toHaveBeenCalledWith(
      mockSignatureData.struct,
      mockSignatureData.signature,
      'test-key',
    )
  })

  it('should return 400 when signature data is missing', async () => {
    const response = await request(app).post('/api/gelato/forward').send({})

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Bad request: Missing required signature data')
    expect(response.body.data).toBeNull()
  })

  it('should return 500 when GELATO_SPONSOR_API_KEY is missing in non-queue-mode', async () => {
    app.set('GELATO_USE_QUEUE', false)
    app.set('GELATO_SPONSOR_API_KEY', undefined)

    const response = await request(app).post('/api/gelato/forward').send(mockSignatureData)

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Gelato Sponsor API key not configured')
    expect(response.body.data).toBeNull()
  })
})

describe('GET /api/gelato/tasks/:taskId', () => {
  beforeEach(() => {
    app.set('GELATO_USE_QUEUE', true)
    jest.clearAllMocks()
  })
  it('should return 404 when task is not found', async () => {
    const response = await request(app).get('/api/gelato/tasks/nonexistent-task')

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('Task not found')
  })

  it('should successfully return task details', async () => {
    const mockTask = {
      status: 'QUEUED',
      gelatoTaskId: '0x123',
      txHash: '0x456',
      retryCount: 0,
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    ;(dataSource.getRepository as jest.Mock)().findOne.mockResolvedValueOnce(mockTask)

    const response = await request(app).get('/api/gelato/tasks/existing-task')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: mockTask.status,
      gelatoTaskId: mockTask.gelatoTaskId,
      txHash: mockTask.txHash,
      retryCount: mockTask.retryCount,
      failureReason: mockTask.failureReason,
      createdAt: mockTask.createdAt.toISOString(),
      updatedAt: mockTask.updatedAt.toISOString(),
    })
  })

  it('should return error when GELATO_USE_QUEUE is false', async () => {
    app.set('GELATO_USE_QUEUE', false)

    const response = await request(app).get('/api/gelato/tasks/any-task')

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Queue processing is not enabled')
  })
})
