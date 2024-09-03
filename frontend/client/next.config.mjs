const devConfig = {
  env: {
    abiConfigUrl: 'https://localhost:3000/api/abi.json',
    blindedSignatureUrl: 'https://152.53.65.200:3004/api/sign',
    signVotingTransactionUrl: 'https://152.53.65.200:3005/api/votingTransaction/sign',
    graphConnectUrl: 'https://netcup.opn.vote:18000/subgraphs/name/opnvote-001',
    gelatoForwardUrl: 'https://152.53.65.200:3005/api/gelato/forward',
  },
  images: {
    domains: ['localhost', 'static.openpetition.de'],
  },
}

const prodConfig = {
  env: {
    abiConfigUrl: 'https://client-test.opn.vote/api/abi.json',
    blindedSignatureUrl: 'https://152.53.65.200:3004/api/sign',
    signVotingTransactionUrl: 'https://152.53.65.200:3005/api/votingTransaction/sign',
    graphConnectUrl: 'https://netcup.opn.vote:18000/subgraphs/name/opnvote-001',
    gelatoForwardUrl: 'https://152.53.65.200:3005/api/gelato/forward',
  },

  output: 'export',
  // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
  trailingSlash: true,
  
  //Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
  skipTrailingSlashRedirect: false,
  assetPrefix: "https://client-test.opn.vote/",
  
  // Optional: Change the output directory `out` -> `dist`
  distDir: 'dist',
  reactStrictMode: true,
  images: {
      unoptimized: true,
      domains: ['localhost', 'static.openpetition.de'],
    },
}

/** @type {import('next').NextConfig} **/
const nextConfig = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
export default nextConfig;