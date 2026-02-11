import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { bls12_381 } from '@noble/curves/bls12-381'

const Fr = bls12_381.fields.Fr
const G1 = bls12_381.G1
const G2 = bls12_381.G2

function randomScalar(): bigint {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  let n = 0n
  for (const b of bytes) n = (n << 8n) + BigInt(b)
  return (n % (Fr.ORDER - 1n)) + 1n
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')))

app.post('/sign', (req, res) => {
  const { blindedPoint } = req.body

  // Deserialize blinded point M'
  const M_prime = G1.Point.fromHex(blindedPoint)

  // Generate sk/pk
  const sk = randomScalar()
  const pk = G2.Point.BASE.multiply(sk)

  // Blind sign: S' = sk * M'
  const S_prime = M_prime.multiply(sk)

  res.json({
    pk: pk.toHex(false),
    blindSig: S_prime.toHex(false),
  })
})

const certDir = path.join(__dirname, '..', '..')
const sslOpts = {
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
}

https.createServer(sslOpts, app).listen(7419, () => console.log('Signing server on https://localhost:7419'))
