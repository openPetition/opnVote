export type TargetState = 'RegistrationPending' | 'VotingPending' | 'Active' | 'Ended' | 'ResultsPublished'

export interface IpfsPayload {
  title: string
  headerImage: { large: string; small: string }
  description: string
  summary: string
  questions: Array<{ text: string; imageUrl: string }>
  backLink: string
}

export interface RegisterKey {
  n: string
  e: string
}

export interface DemoElection {
  targetState: TargetState
  ipfs: IpfsPayload
  publicKey: string
  registerKey?: RegisterKey
  privateKey?: string
}

const TITLE = 'Deutschlands fuenfte, selbstorganisierte, bundesweite Volksabstimmung'

const BASE_IPFS = {
  headerImage: {
    large: 'https://www.opn.vote/sample1_header.png',
    small: 'https://www.opn.vote/sample1_header.png',
  },
  description:
    'Deutschland braucht Mitbestimmung der Bürgerinnen und Bürger auch auf Bundesebene. ' +
    'Gerade die jetzige Zeit zeigt, dass es ohne uns nicht geht! Deswegen organisieren wir ' +
    'bundesweite Volksabstimmungen zu brennenden Fragen der Zeit einfach selbst – bis ' +
    'Abstimmungen auf Bundesebene gesetzlich verankert sind.',
  questions: [
    {
      text: 'Mehr Löwenzahn für Alle!',
      imageUrl: 'https://www.opn.vote/sample1_flower.png',
    },
    {
      text: 'Fliegen wie ein Football - jetzt möglich machen!',
      imageUrl: 'https://www.opn.vote/sample1_sports.png',
    },
  ],
  backLink: 'https://www.openpetition.de/opn-vote',
}

export function getDemoElections(): Array<DemoElection> {
  const electionPubkey = process.env.ELECTION_PUBKEY!
  const registerKey: RegisterKey = {
    n: process.env.REGISTER_KEY_N!,
    e: process.env.REGISTER_KEY_E!,
  }
  const privateKey = process.env.ELECTION_PRIVKEY!

  return [
    {
      targetState: 'RegistrationPending',
      publicKey: electionPubkey,
      ipfs: { ...BASE_IPFS, title: `Registration Pending: ${TITLE}`, summary: `Registration Pending: ${TITLE}` },
    },
    {
      targetState: 'VotingPending',
      publicKey: electionPubkey,
      ipfs: { ...BASE_IPFS, title: `Voting Pending: ${TITLE}`, summary: `Voting Pending: ${TITLE}` },
    },
    {
      targetState: 'Active',
      publicKey: electionPubkey,
      registerKey,
      ipfs: { ...BASE_IPFS, title: `Active: ${TITLE}`, summary: `Active: ${TITLE}` },
    },
    {
      targetState: 'Ended',
      publicKey: electionPubkey,
      registerKey,
      ipfs: { ...BASE_IPFS, title: `Ended: ${TITLE}`, summary: `Ended: ${TITLE}` },
    },
    {
      targetState: 'ResultsPublished',
      publicKey: electionPubkey,
      registerKey,
      privateKey,
      ipfs: { ...BASE_IPFS, title: `Results Published: ${TITLE}`, summary: `Results Published: ${TITLE}` },
    },
  ]
}
