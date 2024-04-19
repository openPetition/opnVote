import { Request, Response, NextFunction } from 'express';
import { header, validationResult } from 'express-validator';
import { ApiResponse } from '../types/apiResponses';

export const jwtTokenValidator = () => [
    header('authorization')
        .exists({ checkFalsy: true })
        .withMessage('Authorization header is required')
        .bail()  
        .matches(/^Bearer\s[\w-]+\.[\w-]+\.[\w-]+$/)
        .withMessage('Authorization header must be in Bearer token format'),
    (req:Request, res:Response, next:NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                data: null,
                error: 'Validation error on authorization header',
                details: errors.array()
            } as ApiResponse<null>);
        }
        next();
    }
];
