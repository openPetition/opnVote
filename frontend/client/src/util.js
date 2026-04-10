'use client'

import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import BallotNotFittingError from "./errors/BallotNotFittingError";
import BallotInvalidError from "./errors/BallotInvalidError";

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
        let credentials = qrToElectionCredentials(code);
        if (Object.keys(credentials).length > 0) {
            validateCredentials(credentials);
            if (election?.id && (parseInt(credentials?.electionID) === parseInt(election?.id))) {
                return {
                    result: 'success',
                    credentials: credentials,
                    registerCode: code,
                };
            } else {
                return {
                    result: 'error',
                    error: new BallotNotFittingError(),
                };
            }
        }
    } catch (e) {
        return {
            result: 'error',
            error: new BallotInvalidError(),
        };
    }

};