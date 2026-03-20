import request from 'supertest'
import { app } from '../svsServer'
import { ipRequests } from './forwardRoutes'

jest.mock('../database', () => ({
  dataSource: {
    initialize: jest.fn().mockResolvedValue(null),
    destroy: jest.fn().mockResolvedValue(null),
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const PAYMASTER = '0xd4726750592678a45F24734354094717D0362D94'
const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108'
beforeEach(() => {
  mockFetch.mockReset()
  ipRequests.clear()
  app.set('BUNDLER_URL', 'https://bundler.example.com/rpc')
  app.set('PAYMASTER_ADDRESS', PAYMASTER)
  app.set('ENTRYPOINT_ADDRESS', ENTRY_POINT)
})

describe('POST /api/forward', () => {
  const validSendRequest = {
    jsonrpc: '2.0',
    method: 'eth_sendUserOperation',
    params: [{ sender: '0x1234', paymaster: PAYMASTER, paymasterData: '0x' + 'ab'.repeat(65) }, ENTRY_POINT],
    id: 1,
  }

  const validReceiptRequest = {
    jsonrpc: '2.0',
    method: 'eth_getUserOperationReceipt',
    params: ['0xUserOpHash'],
    id: 2,
  }

  it('should forward eth_sendUserOperation to bundler', async () => {
    const bundlerResponse = { jsonrpc: '2.0', result: '0xUserOpHash', id: 1 }
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(bundlerResponse) })

    const res = await request(app).post('/api/forward').send(validSendRequest)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(bundlerResponse)
    expect(res.body.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('https://bundler.example.com/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSendRequest),
    })
  })

  it('should forward eth_getUserOperationReceipt to bundler', async () => {
    const bundlerResponse = { jsonrpc: '2.0', result: { success: true }, id: 2 }
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(bundlerResponse) })

    const res = await request(app).post('/api/forward').send(validReceiptRequest)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(bundlerResponse)
    expect(res.body.error).toBeNull()
  })

  it('should reject disallowed methods with 403', async () => {
    const res = await request(app)
      .post('/api/forward')
      .send({ jsonrpc: '2.0', method: 'eth_estimateUserOperationGas', params: [], id: 1 })

    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Method not allowed')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should reject pimlico-specific methods with 403', async () => {
    const res = await request(app)
      .post('/api/forward')
      .send({ jsonrpc: '2.0', method: 'pimlico_getUserOperationGasPrice', params: [], id: 1 })

    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Method not allowed')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid JSON-RPC request', async () => {
    const res = await request(app).post('/api/forward').send({ method: 'eth_sendUserOperation' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid JSON-RPC request')
  })

  it('should return 400 when params is not an array', async () => {
    const res = await request(app)
      .post('/api/forward')
      .send({ jsonrpc: '2.0', method: 'eth_sendUserOperation', params: 'invalid', id: 1 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid JSON-RPC request')
  })

  it('should return 500 when BUNDLER_URL is not configured', async () => {
    app.set('BUNDLER_URL', undefined)

    const res = await request(app).post('/api/forward').send(validSendRequest)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Bundler not configured')
  })

  it('should return 502 when bundler request fails', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app).post('/api/forward').send(validSendRequest)

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('Bundler request failed')
  })

  it('should pass through bundler error responses', async () => {
    const errorResponse = { jsonrpc: '2.0', error: { code: -32000, message: 'AA25 invalid nonce' }, id: 1 }
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(errorResponse) })

    const res = await request(app).post('/api/forward').send(validSendRequest)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(errorResponse)
  })

  describe('UserOp validation (eth_sendUserOperation)', () => {
    it('should reject wrong entrypoint', async () => {
      const res = await request(app)
        .post('/api/forward')
        .send({ ...validSendRequest, params: [validSendRequest.params[0], '0xWrongEntryPoint'] })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Invalid entrypoint')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should reject wrong paymaster address', async () => {
      const res = await request(app)
        .post('/api/forward')
        .send({
          ...validSendRequest,
          params: [{ sender: '0x1234', paymaster: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }, ENTRY_POINT],
        })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Invalid paymaster')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should accept paymaster address case-insensitively', async () => {
      const bundlerResponse = { jsonrpc: '2.0', result: '0xHash', id: 1 }
      mockFetch.mockResolvedValue({ json: () => Promise.resolve(bundlerResponse) })

      const res = await request(app)
        .post('/api/forward')
        .send({ ...validSendRequest, params: [{ sender: '0x1234', paymaster: PAYMASTER.toLowerCase() }, ENTRY_POINT] })

      expect(res.status).toBe(200)
    })
  })

  describe('IP rate limiting', () => {
    it('should allow up to 10 requests per minute', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({ jsonrpc: '2.0', result: '0xHash', id: 1 }) })

      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/api/forward').send(validSendRequest)
        expect(res.status).toBe(200)
      }
    })

    it('should return 429 after exceeding 10 requests per minute', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({ jsonrpc: '2.0', result: '0xHash', id: 1 }) })

      for (let i = 0; i < 10; i++) {
        await request(app).post('/api/forward').send(validSendRequest)
      }

      const res = await request(app).post('/api/forward').send(validSendRequest)
      expect(res.status).toBe(429)
      expect(res.body.error).toBe('Rate limit exceeded')
    })
  })
})
