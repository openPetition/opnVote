import { parseJwt } from '@/util';

function createJwt(payload) {
    return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('parseJwt', () => {

    it('parse valid token and match', () => {
        const result = parseJwt(createJwt({
            voterId: 7,
            electionId: 42,
            exp: 2_000_000_000,
        }));

        expect(result).toMatchObject({
            voterId: 7,
            electionId: 42,
            exp: 2_000_000_000,
        });
    });

    it('returns null for invalid token', () => {
        expect(parseJwt('not-a-jwt')).toBeNull();
    });
});
