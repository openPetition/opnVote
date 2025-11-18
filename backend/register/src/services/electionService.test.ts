import { fetchElectionEndTimeStatus } from '../graphql/graphqlClient'
import { ElectionStatusService } from './electionService'

jest.mock('../graphql/graphqlClient', () => ({
  fetchElectionEndTimeStatus: jest.fn(),
}))

describe('ElectionStatusService', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getElectionStatus', () => {
    it('should return null when fetch fails', async () => {
      ;(fetchElectionEndTimeStatus as jest.Mock).mockRejectedValue(new Error('Fetch failed'))

      const result = await ElectionStatusService.getElectionStatus(1)

      expect(result).toBeNull()
      expect(fetchElectionEndTimeStatus).toHaveBeenCalledWith(1)
    })
  })

  describe('isElectionClosed', () => {
    it('should return true if no election data is present', () => {
      const result = ElectionStatusService.isElectionClosed(null)
      expect(result).toBe(true)
    })

    it('should return true if election status is Ended, ResultsPublished, or Canceled', () => {
      const endedElectionData = {
        status: 2,
        votingEndTime: '1750236800',
        registrationEndTime: '1750236800',
      }
      const resultsPublishedElectionData = {
        status: 3,
        votingEndTime: '1750236800',
        registrationEndTime: '1750236800',
      }
      const canceledElectionData = {
        status: 4,
        votingEndTime: '1750236800',
        registrationEndTime: '1750236800',
      }

      expect(ElectionStatusService.isElectionClosed(endedElectionData)).toBe(true)
      expect(ElectionStatusService.isElectionClosed(resultsPublishedElectionData)).toBe(true)
      expect(ElectionStatusService.isElectionClosed(canceledElectionData)).toBe(true)
    })

    it('should return true if election status is Active and closing time is past', () => {
      const activeElectionData = {
        status: 1,
        votingEndTime: String(Date.now() / 1000 - 3600),
        registrationEndTime: String(Date.now() / 1000 - 7200),
      } // Ended one hour ago

      expect(ElectionStatusService.isElectionClosed(activeElectionData)).toBe(true)
    })

    it('should return false if election status is Active and closing time is in the future', () => {
      const activeElectionData = {
        status: 1,
        votingEndTime: String(Date.now() / 1000 + 3600),
        registrationEndTime: String(Date.now() / 1000 - 3600),
      } // Ending in 1 hour

      expect(ElectionStatusService.isElectionClosed(activeElectionData)).toBe(false)
    })
  })

  describe('isRegistrationClosed', () => {
    it('should return true if no election data is present', () => {
      const result = ElectionStatusService.isRegistrationClosed(null)
      expect(result).toBe(true)
    })

    it('should return true if registration end time has passed', () => {
      const electionData = {
        status: 1,
        votingEndTime: String(Date.now() / 1000 + 3600),
        registrationEndTime: String(Date.now() / 1000 - 3600),
      }

      expect(ElectionStatusService.isRegistrationClosed(electionData)).toBe(true)
    })

    it('should return false if registration end time is in the future', () => {
      const electionData = {
        status: 1,
        votingEndTime: String(Date.now() / 1000 + 7200),
        registrationEndTime: String(Date.now() / 1000 + 3600),
      }

      expect(ElectionStatusService.isRegistrationClosed(electionData)).toBe(false)
    })

    it('should return false if registrationEndTime is 0 (open indefinitely)', () => {
      const electionData = {
        status: 1,
        votingEndTime: String(Date.now() / 1000 + 7200),
        registrationEndTime: '0',
      }

      expect(ElectionStatusService.isRegistrationClosed(electionData)).toBe(false)
    })
  })
})
