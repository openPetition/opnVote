import { Entity, PrimaryColumn, Column, BaseEntity } from 'typeorm'

@Entity('registerKeys')
export class RegisterKey extends BaseEntity {
  @PrimaryColumn()
  electionId!: number

  @Column('text')
  N!: string

  @Column('text')
  D!: string

  @Column('text')
  E!: string

  @Column()
  NbitLength!: number

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
