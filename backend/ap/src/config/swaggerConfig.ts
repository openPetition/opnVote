import swaggerJsdoc from 'swagger-jsdoc'
import dotenv from 'dotenv'
dotenv.config()

const SERVER_URL = process.env.SERVER_URL

if (!SERVER_URL) {
  throw new Error('SERVER_URL is not defined in the environment variables')
}

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Authorization API with Swagger',
      version: '1.0.0',
      description: 'Authorization with Swagger Doc',
    },
    servers: [
      {
        url: SERVER_URL,
        description: 'Authorization Provider server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/**/*.ts'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
