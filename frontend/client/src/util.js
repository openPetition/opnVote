'use client'

import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { BallotInvalidError, BallotNotFittingError } from "@/errors";


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

export function checkBallot(election, code) {
    try {
        const credentials = qrToElectionCredentials(code);
        if (Object.keys(credentials).length > 0) {
            validateCredentials(credentials);
            if (election?.id && (parseInt(credentials?.electionID) === parseInt(election?.id))) {
                return {
                    result: 'success',
                    credentials: credentials,
                    registerCode: code,
                };
            }

            return {
                result: 'error',
                error: new BallotNotFittingError(),
                technicalDetails: {
                    key: 'errorpopup.technicaldetails.ballot.notfitting',
                    values: {
                        ACTUAL_ELECTION_ID: credentials?.electionID,
                        EXPECTED_ELECTION_ID: election?.id,
                    },
                },
            };
        }

        return {
            result: 'error',
            error: new BallotInvalidError(),
            technicalDetails: {
                key: 'errorpopup.technicaldetails.ballot.nocredentials',
            },
        };
    } catch (caughtError) {
        return {
            result: 'error',
            error: new BallotInvalidError(),
            technicalDetails: {
                key: 'errorpopup.technicaldetails.ballot.invalid',
                values: {
                    ERROR: caughtError instanceof Error
                        ? caughtError.message || caughtError.name
                        : undefined,
                },
            },
        };
    }
}
