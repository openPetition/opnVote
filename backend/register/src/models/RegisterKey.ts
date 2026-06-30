import { Entity, PrimaryColumn, Column, BaseEntity } from 'typeorm'

@Entity('registerKeys')
export class RegisterKey extends BaseEntity {
  @PrimaryColumn()
  electionId!: number

  @Column('text')
  pk!: string // uncompressed BLS12-381 G2 point hex ('0x' + 384)

  @Column('text')
  sk!: string // BLS scalar as decimal bigint string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
