'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Record<string, string>) {
    setLoading(true);
    setError('');
    const res = await fetch('/backend/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      router.replace('/login');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? 'เกิดข้อผิดพลาด');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ maxWidth: 440, width: '100%', borderRadius: 16 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>ตั้งค่าระบบครั้งแรก</Typography.Title>
        <Typography.Paragraph type="secondary">สร้างหน่วยงานและบัญชีผู้ดูแลระบบ (ทำได้ครั้งเดียว)</Typography.Paragraph>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="orgName" label="ชื่อหน่วยงาน" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="adminName" label="ชื่อผู้ดูแลระบบ" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="adminEmail" label="อีเมล" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="adminPassword" label="รหัสผ่าน (อย่างน้อย 8 ตัว)" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>สร้าง</Button>
        </Form>
      </Card>
    </div>
  );
}
