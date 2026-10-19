This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).


# Getting Started

* be sure that project / branch is up to date
* be sure you have up to date npm / node version

* open a new shell
* cd into `frontend/client`
* `npm install`
* `npm run dev` to run the dev server

Open [https://localhost:3000](https://localhost:3000) (may be a different port) in your browser.

if you want to go through the whole user flow you can start at https://www.dev-openpetition.de/opn-vote?electionId=6 (for now! running local dev server from OP)
it mocks the user verification from OP for now and hands over jwt token (with random user id and election id 6)

# Tech

## Main Components:

### Createkey
* create the user security key (formerly 'secret', qr code) that confirms the identity of the user and that allows them to register for elections
* check the created key

### Register
* check whether the user is allowed to register for election with help of the created security key from step one and creates an election permit (voting authorization card / qr code or as cookie when user wants to go to election directly)
(would not work without jwt!!)

### Pollingstation
* will contain the voting process (checking the election permit) and the vote (selection of answers, putting them into the voting ballot)
* Also contains the confirmation module to see whether the vote is successfully sent
* Only component we can get link directly with hash for later voting http://localhost:PORT/?id=[electionid]#pollingstation
* All other components need a jwt token.

## Deployment

* build (`npm run build`)
* static content should be now in dist folder ... this is the one you can upload
* currently we are on https://client-test.opn.vote/

## styling

* for styling we are using styled components (https://nextjs.org/docs/app/building-your-application/styling/css-modules)
* really global styles we put into globals.css and we try to keep it short as possible with css variables mainly
* all other styles from components we put into corresponding .module.css .. it should have name of the component (e.g. "Button.jsx" - "Buttton.module.css")
* next js is creating namespace for this components with its modules. So module css can only be used inside of the component.

## coding style
* rules for editor are set in `.editorconfig` for the whole openvote project
* in the client directory you can run `npx eslint src/**/*.js*` or `npx eslint filepath` for one file

## Testing

The client uses Jest with React Testing Library and jsdom for fast unit and component tests. These tests do not call real opnVote backends, a blockchain node, or a staging election.

Tests are kept in `__tests__` and mirror the relevant part of the `src` structure:

```text
__tests__/
├── app/
│   └── loadsecret/
│       └── LoadSecret.test.jsx
├── components/
│   └── Button.test.jsx
└── util.test.js
```

Run all unit and component tests:

```bash
npm test
```

Run a single test file or all tests in one directory:

```bash
npm run test:unit -- __tests__/app/loadsecret/LoadSecret.test.jsx
npm run test:unit -- __tests__/app/loadsecret
```

Run tests matching a test name, or rerun affected tests while developing:

```bash
npm run test:unit -- -t "redirects to showkey"
npm run test:unit:watch
```

The existing Selenium flow is kept as a separate legacy end-to-end test because it depends on external systems:

```bash
npm run test:e2e:legacy
```

### Test scope and mocks

Client tests should verify user-visible behaviour and state transitions, for example loading and error states, navigation, and calls to the voting client. SDK and backend results can be represented by deterministic mocks:

```js
const voteClient = {
    vote: jest.fn().mockResolvedValue({
        ok: true,
        value: {
            txHash: '0xtest-transaction',
            userOpHash: '0xtest-user-operation',
        },
    }),
};
```

Use stable election fixtures instead of real elections for Jest tests. Cryptography, smart contracts, and backend behaviour belong in their respective test suites. A small staging smoke test may complement the client tests, but should not be their only foundation.
