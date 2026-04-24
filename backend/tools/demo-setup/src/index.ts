import dotenv from 'dotenv'
import { DemoElection, TargetState, getDemoElections } from './elections'
import { pinToIpfs } from './pinToIpfs'

dotenv.config()

const DAY = 24 * 60 * 60
const START_BUFFER = 10 * 60
const VOTING_DURATION = 5 * 60

const REQUIRED_ENV_VARS = [
  'DEPLOYED_CONTRACT_ADDRESS',
  'RPC_URL',
  'DEPLOYER_ACCOUNT',
  'REGISTER_ACCOUNT',
  'ELECTION_PUBKEY',
  'REGISTER_KEY_N',
  'REGISTER_KEY_E',
  'ELECTION_PRIVKEY',
  'IPFS_SERVER_URL',
  'IPFS_SIGNER_PRIVATE_KEY',
  'AP_ID',
  'REGISTER_ID',
  'SVS_ID',
  'DEMO_ELECTION_BASE_ID',
]

type Timestamps = {
  votingStartTime: number
  votingEndTime: number
  registrationStartTime: number
  registrationEndTime: number
}

function computeTimestamps(targetState: TargetState): Timestamps {
  const t = Math.floor(Date.now() / 1000)
  switch (targetState) {
    case 'RegistrationPending':
      return {
        registrationStartTime: t + 365 * DAY,
        registrationEndTime: t + 730 * DAY,
        votingStartTime: t + 740 * DAY,
        votingEndTime: t + 755 * DAY,
      }
    case 'VotingPending':
      return {
        registrationStartTime: t - 7 * DAY,
        registrationEndTime: t + 365 * DAY,
        votingStartTime: t + 365 * DAY,
        votingEndTime: t + 380 * DAY,
      }
    case 'Active':
      return {
        registrationStartTime: t - 7 * DAY,
        registrationEndTime: t + 365 * DAY,
        votingStartTime: t + START_BUFFER,
        votingEndTime: t + 365 * DAY,
      }
    case 'Ended':
    case 'ResultsPublished':
      return {
        registrationStartTime: t - 7 * DAY,
        registrationEndTime: t + START_BUFFER + VOTING_DURATION,
        votingStartTime: t + START_BUFFER,
        votingEndTime: t + START_BUFFER + VOTING_DURATION,
      }
  }
}

function forgeCmd(script: string, env: string[], account: string): string {
  return [
    ...env.map(e => `  ${e} \\`),
    `  forge script script/${script} \\`,
    `    --rpc-url ${process.env.RPC_URL} \\`,
    `    --account ${account} \\`,
    `    --broadcast`,
  ].join('\n')
}

function printElectionCommands(
  election: DemoElection,
  electionId: number,
  cid: string,
  ts: Timestamps,
): void {
  const addr = process.env.DEPLOYED_CONTRACT_ADDRESS!
  const deployer = process.env.DEPLOYER_ACCOUNT!
  const register = process.env.REGISTER_ACCOUNT!
  const id = String(electionId)

  const print = (label: string, cmd: string, after?: number) => {
    if (after)
      console.log(`# Run in ~${Math.round((after - Math.floor(Date.now() / 1000)) / 60)} minutes`)
    console.log(`# ${label}\n${cmd}\n`)
  }

  print(
    'CreateElection',
    forgeCmd(
      'CreateElection.s.sol',
      [
        `DEPLOYED_CONTRACT_ADDRESS=${addr}`,
        `ELECTION_ID=${id}`,
        `ELECTION_START_TIME=${ts.votingStartTime}`,
        `ELECTION_END_TIME=${ts.votingEndTime}`,
        `REGISTRATION_START_TIME=${ts.registrationStartTime}`,
        `REGISTRATION_END_TIME=${ts.registrationEndTime}`,
        `AP_ID=${process.env.AP_ID}`,
        `REGISTER_ID=${process.env.REGISTER_ID}`,
        `SVS_ID=${process.env.SVS_ID}`,
        `ELECTION_CID=${cid}`,
        `ELECTION_PUBKEY=${election.publicKey}`,
      ],
      deployer,
    ),
  )

  if (election.targetState === 'RegistrationPending' || election.targetState === 'VotingPending')
    return

  const { n, e } = election.registerKey!

  print(
    'SetRegisterElectionKey',
    forgeCmd(
      'SetRegisterElectionKey.s.sol',
      [
        `DEPLOYED_CONTRACT_ADDRESS=${addr}`,
        `ELECTION_ID=${id}`,
        `REGISTER_ELECTION_N=${n}`,
        `REGISTER_ELECTION_E=${e}`,
      ],
      register,
    ),
  )

  print(
    'StartElection',
    forgeCmd(
      'StartElection.s.sol',
      [`DEPLOYED_CONTRACT_ADDRESS=${addr}`, `ELECTION_ID=${id}`],
      deployer,
    ),
    ts.votingStartTime,
  )

  if (election.targetState === 'Active') return

  print(
    'EndElection',
    forgeCmd(
      'EndElection.s.sol',
      [`DEPLOYED_CONTRACT_ADDRESS=${addr}`, `ELECTION_ID=${id}`],
      deployer,
    ),
    ts.votingEndTime,
  )

  if (election.targetState === 'Ended') return

  print(
    'PublishResults',
    forgeCmd(
      'PublishResults.s.sol',
      [
        `DEPLOYED_CONTRACT_ADDRESS=${addr}`,
        `ELECTION_ID=${id}`,
        `ELECTION_PRIVATE_KEY=${election.privateKey}`,
      ],
      deployer,
    ),
    ts.votingEndTime,
  )
}

async function main(): Promise<void> {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(', ')}`)

  const baseId = Number.parseInt(process.env.DEMO_ELECTION_BASE_ID!, 10)
  if (Number.isNaN(baseId)) throw new Error('DEMO_ELECTION_BASE_ID is not a valid integer')

  const elections = getDemoElections()

  console.log(`# Contract: ${process.env.DEPLOYED_CONTRACT_ADDRESS}`)
  console.log(`# Base ID:  ${baseId}\n`)

  for (const [index, election] of elections.entries()) {
    const electionId = baseId + index
    const ts = computeTimestamps(election.targetState)

    console.log(
      `### [${index + 1}/${elections.length}] "${election.ipfs.title}" (ID: ${electionId}, target: ${election.targetState})\n`,
    )

    try {
      process.stdout.write('  Pinning IPFS... ')
      const cid = await pinToIpfs({
        ...election.ipfs,
        registrationStartTime: ts.registrationStartTime,
        registrationEndTime: ts.registrationEndTime,
      })
      console.log(`CID: ${cid}\n`)
      printElectionCommands(election, electionId, cid, ts)
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
