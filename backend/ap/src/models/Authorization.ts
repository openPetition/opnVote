import { Entity, Column, CreateDateColumn, Unique, PrimaryColumn, Index } from 'typeorm'

@Entity('authorizations')
@Unique('uc_voter_election', ['voterId', 'electionId'])
@Index('idx_status_created', ['onchainStatus', 'createdDate'])
export class Authorization {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  voterId!: number

  @PrimaryColumn({ type: 'int', unsigned: true })
  electionId!: number

  @Column({ type: 'varchar', nullable: true, default: null })
  txHash?: string | null

  @Column({
    type: 'varchar',
    nullable: true,
    default: 'pending',
  })
  onchainStatus!: 'pending' | 'submitted' | 'confirmed' | 'failed'

  @Column({ type: 'varchar', nullable: true })
  batchId?: string | null

  @CreateDateColumn()
  createdDate!: Date
}
