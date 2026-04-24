import { ethers } from 'ethers'
import fetch from 'node-fetch'
import { IpfsPayload } from './elections'

interface PinnedElectionData extends IpfsPayload {
  registrationStartTime: number
  registrationEndTime: number
}

interface PinResponse {
  success: boolean
  cid: string
}

export async function pinToIpfs(data: PinnedElectionData): Promise<string> {
  const ipfsServerUrl = process.env.IPFS_SERVER_URL!.replace(/\/+$/, '')
  const signerKey = process.env.IPFS_SIGNER_PRIVATE_KEY!

  const signer = new ethers.Wallet(signerKey)
  const message = JSON.stringify(data)
  const signature = await signer.signMessage(message)

  const response = await fetch(`${ipfsServerUrl}/pinElectionData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ electionData: data, signature }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`IPFS pin failed (${response.status}): ${body}`)
  }

  const result = (await response.json()) as PinResponse
  return result.cid
}
