# opnvote SDK demo

Minimal Next.js app demoing opnvote SDK usage

```bash
cp .env.example .env.local   # fill in endpoints + contract addresses
npm install
npm run dev
```

## Account abstraction

- `NEXT_PUBLIC_ENTRYPOINT_ADDRESS=0x4337084d9e255ff0702461cf8895ce9e3b5ff108` — EntryPoint v0.8
- `NEXT_PUBLIC_DELEGATION_ADDRESS=0xe6Cae83BdE06E4c305530e199D7217f42808555B` — EIP-7702 account logic

Enter electionID + a voter JWT, then click through the buttons.
