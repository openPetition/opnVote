import swaggerJsdoc from 'swagger-jsdoc'
import dotenv from 'dotenv'

dotenv.config()

const SERVER_URL = process.env.SERVER_URL

if (!SERVER_URL) {
  throw new Error('SERVER_URL is not defined in the environment variables')
}

const options: swaggerJsdoc.Options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'OpnVote IPFS Election Data Pinning',
      version: '1.0.0',
      description: 'API for pinning election data to IPFS.',
    },
    servers: [
      {
        url: SERVER_URL,
        description: 'IPFS Data Pinning',
      },
    ],
    components: {
      schemas: {
        Question: {
          type: 'object',
          required: ['text', 'imageUrl'],
          properties: {
            text: {
              type: 'string',
              description: 'The text of the question.',
            },
            imageUrl: {
              type: 'string',
              description: "URL of the question's image.",
            },
          },
        },
        ElectionData: {
          type: 'object',
          required: [
            'title',
            'headerImage',
            'description',
            'summary',
            'questions',
            'backLink',
            'registrationStartTime',
            'registrationEndTime',
          ],
          properties: {
            title: {
              type: 'string',
              description: 'Title of the election.',
            },
            headerImage: {
              type: 'object',
              required: ['large', 'small'],
              properties: {
                large: {
                  type: 'string',
                  description: 'Large header image URL for desktop.',
                },
                small: {
                  type: 'string',
                  description: 'Small header image URL for mobile.',
                },
              },
            },
            description: {
              type: 'string',
              description: 'Full description of the election.',
            },
            summary: {
              type: 'string',
              description: 'Summary of the election description.',
            },
            questions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Question',
              },
              description: 'List of questions for the election.',
            },
            backLink: {
              type: 'string',
              description: 'URL to return to the election coordinator',
            },
            registrationStartTime: {
              type: 'integer',
              description: 'Unix timestamp for when registration starts (between 2020 and 2099)',
            },
            registrationEndTime: {
              type: 'integer',
              description: 'Unix timestamp for when registration ends (between 2020 and 2099)',
            },
          },
        },
        PinElectionDataRequest: {
          type: 'object',
          required: ['electionData', 'signature'],
          properties: {
            electionData: {
              $ref: '#/components/schemas/ElectionData',
            },
            signature: {
              type: 'string',
              description: 'Ethereum signature to verify admin authorization.',
            },
          },
        },
      },
    },
  },
  apis: ['./src/ipfsPinningServer.ts'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
