export interface Admin {
    walletAddress: string;
    name: string;
}

export const allowedAuthors: Array<Admin> = [
    { walletAddress: "0xCB3597629386f9C24C85AE3cDCb8Ec0BC6610b1E", name: "openpetiton.org" }
];