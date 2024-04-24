"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const utility_1 = require("./utility");
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
//!Update on production use
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:");
    next();
});
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Opn Vote - Register API',
            version: '1.0.0',
            description: 'Opn Vote Register API',
        },
        components: {
            schemas: {
                Token: {
                    type: 'object',
                    required: ['hexString', 'isMaster', 'isBlinded'],
                    properties: {
                        hexString: {
                            type: 'string',
                            description: 'Hexadecimal string representing the token.',
                        },
                        isMaster: {
                            type: 'boolean',
                            description: 'Flag to indicate if the token is a master token.',
                        },
                        isBlinded: {
                            type: 'boolean',
                            description: 'Flag to indicate if the token is blinded.',
                        },
                    },
                },
                Signature: {
                    type: 'object',
                    properties: {
                        hexString: {
                            type: 'string',
                            description: 'Hexadecimal string representing the signed token.',
                        },
                        isBlinded: {
                            type: 'boolean',
                            description: 'Flag to indicate if the signature is blinded.',
                        },
                    },
                },
            },
        },
    },
    apis: ['app.ts'],
};
const swaggerDocs = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocs));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.redirect('/api-docs');
});
/**
 * @swagger
 * /sign:
 *   post:
 *     summary: Sign a blinded token
 *     description: Signs a token if it meets the criteria of being blinded and not a master token. Returns a blinded signature.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Token'
 *     responses:
 *       200:
 *         description: Blinded token successfully signed. The response includes the blinded signature.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Signature'
 *       400:
 *         description: Invalid token data. This could be due to incorrect format, a master token, or an unblinded token.
 *       500:
 *         description: Server error or unexpected condition encountered.
 */
app.post('/sign', (req, res) => {
    try {
        const token = req.body;
        const BLINDED_TOKEN_LENGTH = 130;
        if (typeof token.hexString !== 'string' ||
            typeof token.isMaster !== 'boolean' ||
            typeof token.isBlinded !== 'boolean') {
            return res.status(400).send("Invalid format: All token fields must be provided");
        }
        if (token.isMaster) {
            return res.status(400).send("Cannot sign Master Tokens");
        }
        if (!token.isBlinded) {
            return res.status(400).send("Token must be blinded for signing.");
        }
        if (token.hexString.length !== BLINDED_TOKEN_LENGTH || !(0, utility_1.isValidHex)(token.hexString)) {
            return res.status(400).send("Invalid token hex data");
        }
        // Blinded Token Format Check
        if (!token.hexString.toLowerCase().startsWith("0x1")) {
            return res.status(400).send("Invalid blinded Token format");
        }
        const blindedSignature = (0, utility_1.signToken)(token);
        res.send({ Signature: blindedSignature });
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
        }
        else {
            res.status(500).send('An unexpected error occurred');
        }
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
