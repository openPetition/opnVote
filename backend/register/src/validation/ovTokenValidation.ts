import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { isValidHex } from 'votingsystem';
import { ApiResponse } from '../types/apiResponses';

export const blindedTokenValidationRules = () => [
    body('token.hexString')
        .exists({ checkNull: true, checkFalsy: true }).withMessage('Token hex string is required')
        .isString().withMessage('Token hex string must be a string')
        .isLength({ min: 130, max: 130 }).withMessage('Token hex string must be 130 characters long')
        .matches(/^0x1/).withMessage('Token hex string must start with 0x1'),

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
        .custom(({ hexString }) => {
            if (!isValidHex(hexString)) {
                throw new Error('Invalid token hex data');
            }
            return true;
        }),
        (req:Request, res:Response, next:NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    data: null,
                    error: 'Parameter Validation faild',
                    details: errors.array()
                } as ApiResponse<null>);
            }
            next();
        }
];

