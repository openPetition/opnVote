import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryColumn } from 'typeorm'

@Entity('forwardedTransactions')
export class ForwardedTransactionEntity {
  @PrimaryColumn({ length: 42 })
  senderAddress!: string

  @Column({ type: 'int', default: 0 })
  forwardCount!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  modifiedAt!: Date
}
