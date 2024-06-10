This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).


## Getting Started

* be sure that project / branch is up to date

# 1. prepare votingsystem 
Votingsystem includes the calculations for all our steps. e.g. it returns and checks all our ballot papers

* go into votingsystem folder
* we need first to install all dependencies of this votingsystem with 'npm install'
* then run npm build for having a 'dist build' (distribution folder - all this stuff packed)
* then we need to create a so called link - locally we need to link this package to the frontend 'npm link'
( for more informations about linking you can read https://medium.com/dailyjs/how-to-use-npm-link-7375b6219557 )

# 2. run mock server for registration
go into mock servers and start registration server with 'npm start'

# 3. opnreg
* first install dependencies 'npm install'
* link the votingsystem ('npm link votingsystem')
* start server ('npm run dev')

Under [http://localhost:3000](http://localhost:3000) (or wherever it starterd) we can see the result e.g. under 

http://localhost:3000/createsecret
creating the user secret (qr code) that confirms the identity of the user and that he is allowed to register for elections

http://localhost:3000/register/[electionid]
checks wether the user is allowed to register for election with help of the created secret from step one and creates a voting authorization card (qr code or as cookie when user wants to go to election directly)

http://localhost:3000/pollingstation/[electionid]
will contain the voting process (checking the voting authorization card) and the vote (selection of answers, putting them into the voting ballot)