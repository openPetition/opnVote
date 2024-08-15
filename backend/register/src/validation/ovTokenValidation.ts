import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { validateToken, Token } from 'votingsystem';
import { ApiResponse } from '../types/apiResponses';

export const blindedTokenValidationRules = () => [
    body('token')
        .exists({ checkNull: true, checkFalsy: true }).withMessage('Token is required')
        .isObject().withMessage('Token must be an object'),

    body('token.isMaster')
        .exists({ checkNull: true, checkFalsy: false }).withMessage('Master token status is required')
        .isBoolean().withMessage('Master token status must be boolean')
        .custom(value => {
            if (value) {
                throw new Error('Cannot sign Master Tokens');
            }
            return true;
        }),

    body('token.isBlinded')
        .exists({ checkNull: true, checkFalsy: false }).withMessage('Blinded status is required')
        .isBoolean().withMessage('Blinded status must be boolean')
        .custom(value => {
            if (!value) {
                throw new Error('Token must be blinded for signing');
            }
            return true;
        }),

    body('token')
        .custom((token: Token) => {
            try {
                validateToken(token, true);
                return true;
            } catch (error) {
                throw new Error((error as Error).message);
            }
        }),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                data: null,
                error: 'Parameter Validation failed',
                details: errors.array()
            } as ApiResponse<null>);
        }
        next();
    }
];