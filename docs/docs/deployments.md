# Deployments

<!-- Deployed environments with contract addresses and service endpoints. Please use the Testing environment for bug testing and security research. -->

## Production

| Component                       | Details                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpnVote.sol**                 | [`0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90`](https://gnosisscan.io/address/0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90)                                                                               |
| **Network**                     | Gnosis Chain (Mainnet)                                                                                                                                                                                 |
| **Chain ID**                    | `100`                                                                                                                                                                                                  |
| **Authorization Provider**      | [`https://ap.opn.vote/`](https://ap.opn.vote/) ([Swagger](https://ap.opn.vote/api-docs/))                                                                                                              |
| **Register Service**            | [`https://register.opn.vote/`](https://register.opn.vote/) ([Swagger](https://register.opn.vote/api-docs/))                                                                                            |
| **Signature Validation Server** | [`https://svs.opn.vote/`](https://svs.opn.vote/) ([Swagger](https://svs.opn.vote/api-docs/))                                                                                                           |
| **Subgraph**                    | [`https://graphql.opn.vote/subgraphs/name/opnvote-prod-0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90/`](https://graphql.opn.vote/subgraphs/name/opnvote-prod-0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90/) |

## Development

| Component                       | Details                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpnVote.sol**                 | [`0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28`](https://gnosisscan.io/address/0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28)                                                                                     |
| **Network**                     | Gnosis Chain (Mainnet)                                                                                                                                                                                       |
| **Chain ID**                    | `100`                                                                                                                                                                                                        |
| **Authorization Provider**      | [`https://ap.dev.opn.vote/`](https://ap.dev.opn.vote/) ([Swagger](https://ap.dev.opn.vote/api-docs/))                                                                                                        |
| **Register Service**            | [`https://register.dev.opn.vote/`](https://register.dev.opn.vote/) ([Swagger](https://register.dev.opn.vote/api-docs/))                                                                                      |
| **Signature Validation Server** | [`https://svs.dev.opn.vote/`](https://svs.dev.opn.vote/) ([Swagger](https://svs.dev.opn.vote/api-docs/))                                                                                                     |
| **IPFS Pinning Server**         | [`https://ipfs.dev.opn.vote/`](https://ipfs.dev.opn.vote/) ([Swagger](https://ipfs.dev.opn.vote/api-docs/))                                                                                                  |
| **Subgraph**                    | [`https://graphql.dev.opn.vote/subgraphs/name/opnvote-dev-0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28/`](https://graphql.dev.opn.vote/subgraphs/name/opnvote-dev-0x6df22e4e4ede7e4e73b3608bcb5508b892a1fd28/) |

## Testing

<!-- | Component                       | Details                           |
| ------------------------------- | --------------------------------- |
| **OpnVote.sol**                 | `[CONTRACT_ADDRESS]`              |
| **Network**                     | Gnosis Chain (Chiado Testnet)     |
| **Chain ID**                    | `10200`                           |
| **Authorization Provider**      | `[URL]` ([Swagger](URL/api-docs)) |
| **Register Service**            | `[URL]` ([Swagger](URL/api-docs)) |
| **Signature Validation Server** | `[URL]` ([Swagger](URL/api-docs)) |
| **RPC Gateway**                 | `[URL]` ([Swagger](URL/api-docs)) |
| **Graph Gateway**               | `[URL]` ([Swagger](URL/api-docs)) |
| **IPFS Pinning Server**         | `[URL]` ([Swagger](URL/api-docs)) |
| **Subgraph**                    | `[URL]`                           | -->

---

## Deployed Elections

### Production Elections

| Election ID | Status    | Description                                                                                          | Votes    | Authorizations | Registrations | Register                                                                    | Authorization Provider                                                                                  |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------- | -------- | -------------- | ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `15`        | `Running` | Germany's fourth self-organized nationwide referendum for real citizen participation. (Abstimmung21) | `11,998` | `23,532`       | `20,583`      | [`https://www.opn.vote/`](https://www.opn.vote/) (opn.vote Register v0.1.0) | [`https://www.openpetition.de/opn-vote`](https://www.openpetition.de/opn-vote) (openPetition AP v0.1.0) |

### Test Elections

| Election ID | Environment | Status    | Description                                                                                | Votes    | Authorizations | Registrations | Register                                                                     | Authorization Provider                                                                                  |
| ----------- | ----------- | --------- | ------------------------------------------------------------------------------------------ | -------- | -------------- | ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `11`        | Production  | `Running` | TEST Germany's fourth self-organized nationwide referendum for real citizen participation. | `11`     | `6`            | `90`          | [`https://www.opn.vote/`](https://www.opn.vote/) (opn.vote Register v0.1.0)  | [`https://www.openpetition.de/opn-vote`](https://www.openpetition.de/opn-vote) (openPetition AP v0.1.0) |
| `7`         | Development | `Running` | TEST A new self-organized nationwide referendum for citizen participation in Germany.      | `63,749` | `69,638`       | `6,389`       | [`https://register.opn.vote`](https://register.opn.vote) (OpenVote Register) | [`https://www.openpetition.de/ap/`](https://www.openpetition.de/ap/) (OpenPetition AP 2)                |

_Data as of October 24, 2025._

---

**Note**: Check Swagger documentation for authentication and usage details. For integration support, contact [info@opn.vote](mailto:info@opn.vote).
