import { Request, Response, Application } from 'express';
import jwt from 'jsonwebtoken';
import authenticateJWT from './authenticateJWT';

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn()
}));

describe('authenticateJWT Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;

    beforeEach(() => {
        mockReq = {
            headers: {
                authorization: 'Bearer fakeToken123'
            },
            app: {
                get: jest.fn(() => 'mockPublicKey')
            } as unknown as Partial<Application> as Application
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        nextFunction = jest.fn();
    });

    it('should call next if token is valid', () => {
        (jwt.verify as jest.Mock).mockReturnValue({ userID: 1, electionID: 1 });
        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next and set user if token is valid', () => {
        const userData = { userID: 1, electionID: 1 };
        (jwt.verify as jest.Mock).mockReturnValue(userData);
        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockReq.user).toEqual(userData);
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if the authorization header is missing', () => {

        mockReq.headers!.authorization = '';

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Authorization header must be Bearer [token]',
        });
    });

    it('should return 401 if the authorization header is malformed', () => {
        mockReq.headers!.authorization = 'WrongFormatToken123';

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Authorization header must be Bearer [token]',
        });
    });

    it('should return 403 if the token is invalid', () => {
        (jwt.verify as jest.Mock).mockImplementation(() => {
            throw new Error('Invalid token');
        });

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Failed to authenticate JWT',
        });
    });

    it('should return 403 if userID in JWT payload is not positive numbers', () => {
        (jwt.verify as jest.Mock).mockReturnValue({ userID: -1, electionID: 0 });

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Failed to authenticate JWT',
        });
    });

    it('should return 403 if electionID in JWT payload is not positive numbers', () => {
        (jwt.verify as jest.Mock).mockReturnValue({ userID: 0, electionID: -1 });

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Failed to authenticate JWT',
        });
    });

    it('should return 403 if userID or electionID in JWT payload is not positive numbers', () => {
        (jwt.verify as jest.Mock).mockReturnValue({ userID: "0", electionID: -1 });

        authenticateJWT(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Failed to authenticate JWT',
        });
    });



});

