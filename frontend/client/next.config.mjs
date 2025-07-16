const { i18n } = import('./next-i18next.config.js');
const devConfig = {
    i18n,
    env: {
        basicUrl: 'https://localhost:3000',
        abiConfigUrl: 'https://localhost:3000/api/abi.json',
        blindedSignatureUrl: 'https://register.dev.opn.vote/api/sign',
        signVotingTransactionUrl: 'https://svs.dev.opn.vote/api/votingTransaction/sign',
        graphConnectUrl: 'https://graphql.dev.opn.vote/subgraphs/name/opnvote-dev-0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28',
        gelatoForwardUrl: 'https://svs.dev.opn.vote/api/gelato/forward',
        opnVoteContractAddress: '0x6dF22e4e4eDe7e4E73B3608Bcb5508B892a1fD28',
        rpcnodeUrl: 'https://rpc.opn.vote',
        maxVoteRecasts: 2,

    },
    images: {
        domains: ['localhost', 'static.openpetition.de', 'client-test.opn.vote'],
    },
};

const stagingConfig = {
    i18n,
    env: {
        basicUrl: 'https://client-test.opn.vote',
        abiConfigUrl: 'https://client-test.opn.vote/api/abi.json',
        blindedSignatureUrl: 'https://register.dev.opn.vote/api/sign',
        signVotingTransactionUrl: 'https://svs.dev.opn.vote/api/votingTransaction/sign',
        graphConnectUrl: 'https://graphql.dev.opn.vote/subgraphs/name/opnvote-dev-0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28',
        gelatoForwardUrl: 'https://svs.dev.opn.vote/api/gelato/forward',
        opnVoteContractAddress: '0x6dF22e4e4eDe7e4E73B3608Bcb5508B892a1fD28',
        rpcnodeUrl: 'https://rpc.opn.vote',
        maxVoteRecasts: 2,
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
};

const prodConfig = {
    i18n,
    env: {
        basicUrl: 'https://client.opn.vote',
        abiConfigUrl: 'https://client.opn.vote/api/abi.json',
        blindedSignatureUrl: 'https://register.opn.vote/api/sign',
        signVotingTransactionUrl: 'https://svs.opn.vote/api/votingTransaction/sign',
        graphConnectUrl: 'https://graphql.opn.vote/subgraphs/name/opnvote-003',
        gelatoForwardUrl: 'https://svs.opn.vote/api/gelato/forward',
        opnVoteContractAddress: '0xc2958f59C2F333b1ad462C7a3969Da1E0B662459',
        rpcnodeUrl: 'https://rpc.opn.vote',
        maxVoteRecasts: 2,
    },

    output: 'export',
    // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
    trailingSlash: true,

    //Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
    skipTrailingSlashRedirect: false,
    assetPrefix: "https://client.opn.vote/",

    // Optional: Change the output directory `out` -> `dist`
    distDir: 'dist',
    reactStrictMode: true,
    images: {
        unoptimized: true,
        domains: ['localhost', 'static.openpetition.de'],
    },
};

/** @type {import('next').NextConfig} **/
const nextConfig = process.env.NODE_ENV === 'production' ? prodConfig : (process.env.NODE_ENV === 'staging' ? stagingConfig : devConfig);
export default nextConfig;
