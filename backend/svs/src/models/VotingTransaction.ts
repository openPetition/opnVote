import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm'

@Entity('votingTransactions')
export class VotingTransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  electionId!: number

  @Column({ length: 42 })
  voterAddress!: string

  @Column({ type: 'varchar', length: 1026 })
  encryptedVoteRsa!: string

  @Column({ type: 'varchar', length: 1026 })
  encryptedVoteAes!: string

  @Column()
  unblindedElectionToken!: string

  @Column({ type: 'varchar', length: 1026 })
  unblindedSignature!: string

  @Column({ length: 132 }) // 65 bytes in hex + '0x' prefix
  svsSignature!: string

  @CreateDateColumn()
  timestamp!: Date
}
