import { fetchElectionEndTimeStatus } from '../graphql/graphqlClient';
import { ElectionStatusService } from './electionService';

jest.mock('../graphql/graphqlClient', () => ({
    fetchElectionEndTimeStatus: jest.fn()
}));

describe('ElectionStatusService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getElectionStatus', () => {


        it('should return null when fetch fails', async () => {
            (fetchElectionEndTimeStatus as jest.Mock).mockRejectedValue(new Error('Fetch failed'));

            const result = await ElectionStatusService.getElectionStatus(1);

            expect(result).toBeNull();
            expect(fetchElectionEndTimeStatus).toHaveBeenCalledWith(1);
        });
    });

    describe('isElectionClosed', () => {
        it('should return true if no election data is present', () => {
            const result = ElectionStatusService.isElectionClosed(null);
            expect(result).toBe(true);
        });

        it('should return true if election status is Ended, ResultsPublished, or Canceled', () => {
            const endedElectionData = { status: 2, endTime: '1750236800' };
            const resultsPublishedElectionData = { status: 3, endTime: '1750236800' };
            const canceledElectionData = { status: 4, endTime: '1750236800' };

            expect(ElectionStatusService.isElectionClosed(endedElectionData)).toBe(true);
            expect(ElectionStatusService.isElectionClosed(resultsPublishedElectionData)).toBe(true);
            expect(ElectionStatusService.isElectionClosed(canceledElectionData)).toBe(true);
        });

        it('should return true if election status is Active and closing time is past', () => {
            const activeElectionData = { status: 1, endTime: String(Date.now() / 1000 - 3600) }; // Ended one hour ago

            expect(ElectionStatusService.isElectionClosed(activeElectionData)).toBe(true);
        });

        it('should return false if election status is Active and closing time is in the future', () => {
            const activeElectionData = { status: 1, endTime: String(Date.now() / 1000 + 3600) }; // Ending in 1 hour

            expect(ElectionStatusService.isElectionClosed(activeElectionData)).toBe(false);
        });
    });
});
