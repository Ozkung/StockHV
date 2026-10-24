'use client';
import { useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Input, Tag } from 'antd';
import { useApi } from '@/lib/api';
import { ROLE_COLOR, ROLE_LABEL, Role } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';

interface Me {
  email: string; displayName: string; role: Role; phone: string | null;
  organization: { name: string };
}

export default function ProfilePage() {
  const { message } = App.useApp();
  const { request, ready } = useApi();
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (ready) request<Me>('/auth/me').then(setMe).catch((err) => message.error(err.message));
  }, [ready, request, message]);

  async function changePassword({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) {
    setSaving(true);
    try {
      await request('/auth/me/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      message.success('เปลี่ยนรหัสผ่านแล้ว');
      form.resetFields();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader eyebrow="Account" title="โปรไฟล์" />
      <Card loading={!me} style={{ marginBottom: 16 }}>
        {me && (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="ชื่อ">{me.displayName}</Descriptions.Item>
            <Descriptions.Item label="อีเมล">{me.email}</Descriptions.Item>
            <Descriptions.Item label="สิทธิ์"><Tag color={ROLE_COLOR[me.role]}>{ROLE_LABEL[me.role]}</Tag></Descriptions.Item>
            <Descriptions.Item label="หน่วยงาน">{me.organization.name}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
      <Card title="เปลี่ยนรหัสผ่าน">
        <Form form={form} layout="vertical" onFinish={changePassword}>
          <Form.Item name="currentPassword" label="รหัสผ่านปัจจุบัน" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="รหัสผ่านใหม่" rules={[{ required: true, min: 8, message: 'อย่างน้อย 8 ตัวอักษร' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirm" label="ยืนยันรหัสผ่านใหม่" dependencies={['newPassword']}
            rules={[{ required: true }, ({ getFieldValue }) => ({
              validator: (_, v) => (!v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'))),
            })]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>บันทึก</Button>
        </Form>
      </Card>
    </div>
  );
}
