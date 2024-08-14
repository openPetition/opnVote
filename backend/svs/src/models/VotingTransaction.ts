import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { TransactionStatus } from '../types/transactionTypes';

@Entity('votingTransactions')
export class VotingTransactionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    electionID!: number;

    @Column()
    voterAddress!: string;

    @Column('text')
    encryptedVote!: string;

    @Column()
    unblindedElectionToken!: string;

    @Column()
    unblindedSignature!: string;

    @Column()
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
}
