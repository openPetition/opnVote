# opnVote: Democratic E-Voting System

## Introduction

opnVote is a blockchain-based e-voting framework designed to modernize democratic elections. It offers a secure, transparent, and compliant voting framework, leveraging blockchain technology and blind signatures for heightened security and voter anonymity.


## Project Overview

opnVote is designed to fulfill legal requirements for digital Voting, ensuring the integrity and confidentiality of the voting process. The framework is divided into several key components:

- **Frontend**: A user-friendly interface for voters and administrators
- **Backend**: Includes essential services such as:
  - **Register Server**: Handles voter registration, authentication, and creation of blind signatures.
  - **SVS (Signature Validation Server)**: Validates blind signatures for voter authorization.
  -  **Smart Contracts**: Implements blockchain logic for acceptance and counting of votes.
- **Experiments**: Testing ground for new technologies and methodologies.
### Key Features

- **Privacy**: Leveraging encrypted transactions and blind signatures, opnVote guarantees the confidentiality of each vote, ensuring no traceability back to the voter.

- **Eligibility**: opnVote interfaces with an external Authorization Provider Server to ensure that only verified and eligible voters participate, maintaining the electoral process's legitimacy by relying on external, established voter authorization systems.

- **Unreusability**: opnVote ensures that each eligible voter can vote only once, upholding the principle of one person, one vote.

- **Soundness**: opnVote ensures voting integrity through secure blockchain technology, effectively preventing any unjust interference or disruptions in the voting process.

- **Fairness**: opnVote is designed to be neutral and impartial. The system prevents vote-selling and voter coercion by allowing vote-recasting, ensuring that all votes are cast freely and without external influence.

- **Verifiability**: The combination of blockchain transparency and cryptographic techniques allows for the verification of election results while preserving voter anonymity.

- **Real-Time Results**: opnVote is capable of publishing final election results within hours after voting concludes, enhancing transparency and engagement.


- **Scalability**: opnVote efficiently manages large-scale elections, capable of handling millions of votes without compromising performance.

- **Accessibility**: opnVote is dedicated to inclusivity, ensuring the voting process is accessible to all eligible voters. By utilizing account abstraction, the system allows voters to cast their votes without the need for managing a blockchain wallet.

- **Auditability**: Every step of the voting process is fully auditable, with Blockchain Technology ensuring a transparent and accountable election process.
