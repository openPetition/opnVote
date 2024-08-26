import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { TransactionStatus } from '../types/transactionTypes';

@Entity('votingTransactions')
export class VotingTransactionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    electionID!: number;

    @Column({ length: 42 })
    voterAddress!: string;

    @Column({ type: 'varchar', length: 1026 })
    encryptedVote!: string;

    @Column()
    unblindedElectionToken!: string;

    @Column({ type: 'varchar', length: 1026 })
    unblindedSignature!: string;

    @Column({ length: 132 })  // 65 bytes in hex + '0x' prefix
    svsSignature!: string;

    @Column({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.WAITING
    })
    txStatus!: TransactionStatus;

    @Column({ type: "varchar", nullable: true, default: null })
    txHash?: string | null;

    @Column({ default: false })
    rateLimited!: boolean;

    @CreateDateColumn()
    timestamp!: Date;

    @Column({ type: "timestamp", nullable: true, default: null })
    lastRelayAttempt!: Date | null;

    @Column({ type: "varchar", length: 66, nullable: true, default: null })
    gelatoTaskId?: string | null;
}
