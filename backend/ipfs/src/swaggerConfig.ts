
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL

if(!SERVER_URL){
  throw new Error('SERVER_URL is not defined in the environment variables');
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
          ElectionData: {
            type: 'object',
            required: ['description', 'summary', 'ballot'],
            properties: {
              description: {
                type: 'string',
                description: 'Full description of the election.',
              },
              summary: {
                type: 'string',
                description: 'Summary of the election description.',
              },
              ballot: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'List of ballot questions.',
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
  };

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;