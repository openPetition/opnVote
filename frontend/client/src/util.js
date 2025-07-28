'use client'

export function parseJwt(jwtToken) {
    try {
        const obj = JSON.parse(atob(jwtToken.split('.')[1]));
        const keys = Object.keys(obj);
        if (!['voterId', 'electionId', 'exp'].every((k) => keys.includes(k) && Number.isInteger(obj[k]))) {
            return null;
        }
        return {
            voterId: obj.voterId,
            electionId: obj.electionId,
            exp: obj.exp,
            isExpired: () => (new Date()).getTime() > obj.exp,
        };
    } catch (e) {
        return null;
    }
};
