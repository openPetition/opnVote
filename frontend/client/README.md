This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).


# Getting Started

* be sure that project / branch is up to date
* be sure you have up to date npm / node version

* open a new shell
* cd into `frontend/opnreg`
* `npm install`
* `npx run dev` to run the dev server

Open [https://localhost:3000](https://localhost:3000) (may be a different port) in your browser.

if you want to go through the whole user flow you can start at https://www.dev-openpetition.de/opn-vote?electionId=6 (for now! running local dev server from OP)
it mocks the user verification from OP for now and hands over jwt token (with random user id and election id 6)

# Tech

## Main Components:

### Createkey
* creating the user secret (qr code) that confirms the identity of the user and that he is allowed to register for elections
* check the created key

### Register
* checks wether the user is allowed to register for election with help of the created secret from step one and creates a voting authorization card (qr code or as cookie when user wants to go to election directly)
(would not work without jwt!!)

### Pollingstation
* will contain the voting process (checking the voting authorization card) and the vote (selection of answers, putting them into the voting ballot)
* Also contains the confirmation module to see wether the vote is successfully sended
* Only component we can get directly via link with hash for later voting http://localhost:PORT/?id=[electionid]#pollingstation
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
* in openreg you can run `npx eslint src/**/*.js*` in openreg or `npx eslint filepath` for one file
