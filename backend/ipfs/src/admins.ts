import { ethers } from 'ethers'

export interface Admin {
  walletAddress: string
  name: string
}

export function loadAuthors(value: string): Admin[] {
  const entries = JSON.parse(value)

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('ALLOWED_AUTHORS must a json array')
  }

  const authors: Admin[] = []
  for (const { walletAddress, name } of entries) {
    if (!name) {
      throw new Error(`ALLOWED_AUTHORS: name missing for ${walletAddress}`)
    }

    authors.push({ walletAddress: ethers.getAddress(walletAddress), name })
  }

  return authors
}
