'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Button, Drawer, Menu, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { signOut, useSession } from 'next-auth/react';
import { ClipboardCheck, History, LayoutDashboard, LogOut, Menu as MenuIcon, Package, UserCircle, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { isManager, ROLE_COLOR, ROLE_LABEL, Role } from '@/lib/constants';

const { Text } = Typography;
const ICON = 15;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const role = session?.role as Role | undefined;

  const navItems: NonNullable<MenuProps['items']> = [
    { key: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={ICON} /> },
    { key: '/inventory', label: 'คลังยา & เวชภัณฑ์', icon: <Package size={ICON} /> },
    ...(isManager(role) ? [{ key: '/approvals', label: 'อนุมัติปรับยอด', icon: <ClipboardCheck size={ICON} /> }] : []),
    ...(role === 'ADMIN' ? [
      { key: '/users', label: 'ผู้ใช้งาน', icon: <Users size={ICON} /> },
      { key: '/audit-log', label: 'Audit Log', icon: <History size={ICON} /> },
    ] : []),
    { key: '/profile', label: 'โปรไฟล์', icon: <UserCircle size={ICON} /> },
  ];

  const selectedKey = (navItems.find((i) => i && pathname.startsWith(i.key as string))?.key as string) ?? '/dashboard';
  const userName = session?.displayName ?? '';
  const initials = userName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f5f5f5' }}>
        <Text strong style={{ fontSize: 16 }}>StockHV</Text>
        <div style={{ fontSize: 10, color: '#0f766e', letterSpacing: 2 }}>INVENTORY</div>
      </div>
      <Menu
        mode="inline" selectedKeys={[selectedKey]} items={navItems}
        onClick={({ key }) => { router.push(key); setDrawerOpen(false); }}
        style={{ flex: 1, border: 'none', paddingTop: 8 }}
      />
      <div style={{ padding: 12, borderTop: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fafafa', borderRadius: 8, marginBottom: 8 }}>
          <Avatar size={28} style={{ background: '#0f766e', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</Avatar>
          <div style={{ minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block' }} ellipsis>{userName}</Text>
            {role && <Tag color={ROLE_COLOR[role]} style={{ fontSize: 10, marginTop: 2 }}>{ROLE_LABEL[role]}</Tag>}
          </div>
        </div>
        <Button block size="small" icon={<LogOut size={12} />} onClick={() => signOut({ callbackUrl: '/login' })}>ออกจากระบบ</Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
          <Button type="text" icon={<MenuIcon size={18} />} onClick={() => setDrawerOpen(true)} aria-label="เมนู" />
          <Text strong>StockHV</Text>
        </header>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left" width={240} styles={{ body: { padding: 0 } }} closable={false}>
          {sidebar}
        </Drawer>
        <main style={{ padding: 16 }}>{children}</main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f0f2f5' }}>
      <aside style={{ width: 230, background: '#fff', borderRight: '1px solid #f0f0f0', height: '100vh', flexShrink: 0 }}>
        {sidebar}
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>{children}</main>
    </div>
  );
}
