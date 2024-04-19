# Register Backend

## Description
The Register Backend is designed to authenticate users via JWTs provided by an Authorization Provider (AP) and sign blinded tokens for authorized users. This backend ensures that eligible users can request and receive a blinded signature once per election.

## Features
- **JWT Authentication**: Validates user based on JWTs signed by Authorization Provider.
- **Blinded Token Processing**: Handles the signing of blinded tokens provided by users.
- **Election Status Verification**: Checks the status of elections to determine if token signing is allowed.

## Technologies Used
- Node.js & Express
- TypeORM & MySQL
- JSON Web Tokens for authentication
- GraphQL for data fetching

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/openPetition/opnVote.git
   cd opnVote/backend/register ```

2. **Install dependencies:**
   ``` npm install ```

3. **Install dependencies:**
   Copy the `env.sample` file to create a `.env` file in the root directory. Update this file with the specific values.

## Running the Application
* **Development mode:**
   ```bash
   npm run dev
   ```

* **Production mode:**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints
- `GET /api-docs`: Swagger Documentation
- `GET /api/auth`: Authenticates users and checks if the user is eligible for registration based on the JWT.
- `POST /api/sign`: Authenticates users and receives blinded tokens, signs them, and returns signed blinded signature to users.