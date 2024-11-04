import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import { GelatoQueueStatus } from '../types/gelato';


@Entity('gelatoQueue')
export class GelatoQueueEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('json')
    signatureData!: string;

    @Column({
        type: 'enum',
        enum: GelatoQueueStatus,
        default: GelatoQueueStatus.QUEUED
    })
    status!: GelatoQueueStatus;

    @Column({ length: 42 })
    gelatoUserAddress!: string;

    @Column({ type: "varchar", nullable: true })
    gelatoTaskId?: string | null;

    @Column({ type: "varchar", nullable: true })
    txHash?: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: "varchar", length: 66 })
    requestHash!: string;

    @Column({ type: "int", default: 0 })
    retryCount!: number;

    @Column({ type: "varchar", length: 255, nullable: true })
    failureReason?: string | null;

    @Column({ nullable: true })
    retryAt?: Date;
}