import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as bcrypt from 'bcrypt';
import { User } from './users/entities/user.entity';
import { UserRole } from './users/entities/user-role.entity';
import { Role } from './roles/entities/role.entity';
import { RolePermission } from './roles/entities/role-permission.entity';
import { Permission } from './permissions/entities/permission.entity';
import { UserStatus } from './users/entities/user-status.enum';
import 'dotenv/config';

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, UserRole, Role, RolePermission, Permission],
    namingStrategy: new SnakeNamingStrategy(),
  });

  await dataSource.initialize();
  console.log('Seeding database...');

  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);
  const rpRepo = dataSource.getRepository(RolePermission);
  const userRepo = dataSource.getRepository(User);
  const urRepo = dataSource.getRepository(UserRole);

  // Upsert SuperAdmin role
  let superAdmin = await roleRepo.findOne({ where: { name: 'SuperAdmin' } });
  if (!superAdmin) {
    superAdmin = roleRepo.create({
      name: 'SuperAdmin',
      description: '超级管理员，拥有所有权限',
    });
    await roleRepo.save(superAdmin);
    console.log('Created SuperAdmin role');
  }

  // Upsert Guest role
  let guest = await roleRepo.findOne({ where: { name: 'Guest' } });
  if (!guest) {
    guest = roleRepo.create({
      name: 'Guest',
      description: '默认角色',
    });
    await roleRepo.save(guest);
    console.log('Created Guest role');
  }

  // Create permissions (idempotent)
  const permissionsData = [
    {
      key: 'user:read',
      group: 'user',
      description: '查看用户',
      showInMenu: true,
      menuLabel: '用户管理',
      menuIcon: 'users',
      menuPath: '/admin/users',
      menuOrder: 1,
    },
    { key: 'user:write', group: 'user', description: '编辑用户' },
    { key: 'user:delete', group: 'user', description: '删除用户' },
    { key: 'user:update-status', group: 'user', description: '更新状态' },
    {
      key: 'role:read',
      group: 'role',
      description: '查看角色',
      showInMenu: true,
      menuLabel: '角色管理',
      menuIcon: 'shield',
      menuPath: '/admin/roles',
      menuOrder: 2,
    },
    { key: 'role:write', group: 'role', description: '编辑角色' },
    { key: 'role:delete', group: 'role', description: '删除角色' },
    {
      key: 'permission:read',
      group: 'permission',
      description: '查看权限',
      showInMenu: true,
      menuLabel: '权限管理',
      menuIcon: 'key-round',
      menuPath: '/admin/permissions',
      menuOrder: 3,
    },
    { key: 'permission:write', group: 'permission', description: '编辑权限' },
    { key: 'permission:delete', group: 'permission', description: '删除权限' },
    { key: 'system:manage', group: 'system', description: '系统管理' },
  ];

  for (const pData of permissionsData) {
    const existing = await permRepo.findOne({ where: { key: pData.key } });
    if (!existing) {
      await permRepo.save(permRepo.create(pData));
    } else {
      // Update menu fields for existing permissions
      if (pData.showInMenu !== undefined) {
        existing.showInMenu = pData.showInMenu;
        existing.menuLabel = pData.menuLabel || null;
        existing.menuIcon = pData.menuIcon || null;
        existing.menuPath = pData.menuPath || null;
        existing.menuOrder = pData.menuOrder || 0;
        await permRepo.save(existing);
      }
    }
  }
  console.log('Ensured 11 base permissions exist');

  // Assign all permissions to SuperAdmin
  const allPermissions = await permRepo.find();
  for (const perm of allPermissions) {
    const existing = await rpRepo.findOne({
      where: { roleId: superAdmin.id, permissionId: perm.id },
    });
    if (!existing) {
      await rpRepo.save(
        rpRepo.create({ roleId: superAdmin.id, permissionId: perm.id }),
      );
    }
  }
  console.log('Assigned all permissions to SuperAdmin');

  // Create admin user
  let adminUser = await userRepo.findOne({
    where: { email: 'admin@example.com' },
  });
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    adminUser = userRepo.create({
      email: 'admin@example.com',
      password: hashedPassword,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(adminUser);
    console.log('Created admin user');
  }

  // Assign SuperAdmin role to admin
  const existingUr = await urRepo.findOne({
    where: { userId: adminUser.id, roleId: superAdmin.id },
  });
  if (!existingUr) {
    await urRepo.save(
      urRepo.create({
        userId: adminUser.id,
        roleId: superAdmin.id,
      }),
    );
    console.log('Assigned SuperAdmin role to admin user');
  }

  console.log('Seed completed!');
  console.log('Default admin user: admin@example.com / admin123');

  await dataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
