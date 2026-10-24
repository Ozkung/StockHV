'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { App, Button, Card, Form, Input, Modal, Select, Switch, Table, Tag } from 'antd';
import { useApi } from '@/lib/api';
import { ROLE_COLOR, ROLE_LABEL, Role, formatDate } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';

interface User {
  id: string; email: string; displayName: string; role: Role; phone: string | null; isActive: boolean; createdAt: string;
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export default function UsersPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const { request, ready } = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      setUsers(await request<User[]>('/users'));
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [ready, request, message]);

  useEffect(() => { load(); }, [load]);

  function open(u: User | 'new') {
    form.resetFields();
    form.setFieldsValue(u === 'new' ? { role: 'STAFF' } : { displayName: u.displayName, role: u.role, phone: u.phone });
    setEditing(u);
  }

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing === 'new') {
        await request('/users', { method: 'POST', body: values });
        message.success('เพิ่มผู้ใช้แล้ว');
      } else if (editing) {
        const { password, ...rest } = values;
        await request(`/users/${editing.id}`, { method: 'PATCH', body: { ...rest, ...(password ? { password } : {}) } });
        message.success('บันทึกแล้ว');
      }
      setEditing(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User, isActive: boolean) {
    try {
      await request(`/users/${u.id}`, { method: 'PATCH', body: { isActive } });
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="ผู้ใช้งาน" extra={<Button type="primary" onClick={() => open('new')}>+ เพิ่มผู้ใช้</Button>} />
      <Card>
        <Table
          dataSource={users} rowKey="id" loading={loading} size="middle" scroll={{ x: 680 }} pagination={false}
          columns={[
            { title: 'ชื่อ', dataIndex: 'displayName', render: (v, r) => <div><b>{v}</b><div style={{ fontSize: 12, color: '#888' }}>{r.email}</div></div> },
            { title: 'สิทธิ์', dataIndex: 'role', width: 130, render: (r: Role) => <Tag color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Tag> },
            { title: 'โทร', dataIndex: 'phone', width: 120, render: (v) => v ?? '—' },
            { title: 'สร้างเมื่อ', dataIndex: 'createdAt', width: 110, render: (v) => formatDate(v) },
            {
              title: 'ใช้งาน', dataIndex: 'isActive', width: 80,
              render: (v, r) => <Switch size="small" checked={v} disabled={r.id === session?.userId} onChange={(c) => toggleActive(r, c)} />,
            },
            { title: '', key: 'edit', width: 70, render: (_, r) => <Button size="small" onClick={() => open(r)}>แก้ไข</Button> },
          ]}
        />
      </Card>

      <Modal title={editing === 'new' ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้'} open={!!editing} onOk={save} confirmLoading={saving}
        onCancel={() => setEditing(null)} okText="บันทึก" cancelText="ยกเลิก" destroyOnHidden>
        <Form form={form} layout="vertical" preserve={false}>
          {editing === 'new' && (
            <Form.Item name="email" label="อีเมล" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          )}
          <Form.Item name="displayName" label="ชื่อที่แสดง" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="สิทธิ์" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} disabled={editing !== 'new' && editing?.id === session?.userId} />
          </Form.Item>
          <Form.Item name="phone" label="โทรศัพท์"><Input /></Form.Item>
          <Form.Item name="password" label={editing === 'new' ? 'รหัสผ่าน' : 'รีเซ็ตรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)'}
            rules={[{ required: editing === 'new' }, { min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
