import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
@Entity('votingTransactions')
export class VotingTransactionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    electionID!: number;

    @Column({ length: 42 })
    voterAddress!: string;

    @Column({ type: 'varchar', length: 1026 })
    encryptedVoteRSA!: string;

    @Column({ type: 'varchar', length: 1026 })
    encryptedVoteAES!: string;

    @Column()
    unblindedElectionToken!: string;

    @Column({ type: 'varchar', length: 1026 })
    unblindedSignature!: string;

    @Column({ length: 132 })  // 65 bytes in hex + '0x' prefix
    svsSignature!: string;

    @CreateDateColumn()
    timestamp!: Date;
}