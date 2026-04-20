import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { RolePermission } from '../../roles/entities/role-permission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 50 })
  group: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  showInMenu: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  menuLabel: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  menuIcon: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  menuPath: string | null;

  @Column({ type: 'int', default: 0 })
  menuOrder: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  roles: RolePermission[];
}
