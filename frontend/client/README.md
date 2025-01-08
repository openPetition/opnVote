This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).


## Getting Started

* be sure that project / branch is up to date

# 1. Prepare votingsystem
VotingSystem includes the calculations for all our steps. e.g. it returns and checks all our ballot papers.

* go into folder 'votingSystem'
* install all dependencies of this votingsystem with `npm install`
* then run `npm run build` for having a 'dist build' (distribution folder - all this stuff packed)
* then create a so called link - locally this package needs to be linked to the frontend - `npm link`
(for more information about linking you can read https://medium.com/dailyjs/how-to-use-npm-link-7375b6219557)

# 2. Start opnreg
* take a new shell
* cd into 'frontend/opnreg'
* first install dependencies `npm install`
* link the votingsystem: `npm link votingsystem`
* start server: `npx next dev --experimental-https` (as we have to use http npm run dev ist not enough)

Open [http://localhost:3000](http://localhost:3000) (or wherever it started) in your browser.

http://localhost:3000/createsecret
creating the user secret (qr code) that confirms the identity of the user and that he is allowed to register for elections

http://localhost:3000/register?id=[electionid]
checks wether the user is allowed to register for election with help of the created secret from step one and creates a voting authorization card (qr code or as cookie when user wants to go to election directly)
(would not work without jwt!!)

http://localhost:3000/pollingstation?id=[electionid]
will contain the voting process (checking the voting authorization card) and the vote (selection of answers, putting them into the voting ballot)

if you want to go through the whole user flow you can start at https://www.dev-openpetition.de/opn-vote (running local dev server from OP) 
it mocks the user verification from OP for now and hands over jwt token (with random user id and election id 6)

### Deployment

* build (`npm run build`)
* static content should be now in dist folder ... this is the one you can upload
* currently we are on https://client-test.opn.vote/

#### TECH

### frontend 

we are using ?

### styling 

for styling we are using styled components 
* really global styles we put into globals.css and we try to keep it short as possible with css variables mainly
* all other styles from components we put into corresponding .module.css .. it should have name of the component (e.g. "Button.jsx" - "Buttton.module.css")
* next js is creating namespace for this components with its modules. So module css can only be used inside of the component.

### coding style
* rules for editor are set in `.editorconfig` for the whole openvote project
* in openreg you can run `npx eslint src/**/*.js*` in openreg or `npx eslint filepath` for one file

doc for better understanding: https://nextjs.org/docs/app/building-your-application/styling/css-modules