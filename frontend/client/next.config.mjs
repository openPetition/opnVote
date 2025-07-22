const { i18n } = import('./next-i18next.config.js');

/** @type {import('next').NextConfig} **/
const nextConfig = {
    i18n,
    env: {
        basicUrl: process.env.NEXT_PUBLIC_BASIC_URL,
        abiConfigUrl: process.env.NEXT_PUBLIC_ABI_CONFIG_URL,
        blindedSignatureUrl: process.env.NEXT_PUBLIC_BLINDED_SIGNATURE_URL,
        signVotingTransactionUrl: process.env.NEXT_PUBLIC_SIGN_VOTING_TRANSACTION_URL,
        graphConnectUrl: process.env.NEXT_PUBLIC_GRAPH_CONNECT_URL,
        gelatoForwardUrl: process.env.NEXT_PUBLIC_GELATO_FORWARD_URL,
        opnVoteContractAddress: process.env.NEXT_PUBLIC_OPN_VOTE_CONTRACT_ADDRESS,
        rpcnodeUrl: process.env.NEXT_PUBLIC_RPC_NODE_URL,
        version: process.env.NEXT_PUBLIC_VERSION,
        maxVoteRecasts: 2,
    },
    images: {
        domains: ['localhost', 'static.openpetition.de', 'client-test.opn.vote'],
    },
};
if (process.env.NODE_ENV === 'production') {
    nextConfig.output = 'export';
    nextConfig.trailingSlash = true;

    //Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
    nextConfig.skipTrailingSlashRedirect = false;

    // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
    nextConfig.assetPrefix = process.env.NEXT_PUBLIC_BASIC_URL + "/";

    // Optional: Change the output directory `out` -> `dist`
    nextConfig.distDir = 'dist';
    nextConfig.reactStrictMode = true;
    nextConfig.images = {
        unoptimized: true,
        domains: ['localhost', 'static.openpetition.de'],
    };
} else {
    nextConfig.images = {
        domains: ['localhost', 'static.openpetition.de', 'client-test.opn.vote'],
    };
}

export default nextConfig;
