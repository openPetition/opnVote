import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('forwardedTransactions')
export class ForwardedTransactionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 42 })
    senderAddress!: string;

    @Column({ type: 'int', default: 0 })
    forwardCount!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    modifiedAt!: Date;
}