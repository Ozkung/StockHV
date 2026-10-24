'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { Alert, Button, Card, Form, Input } from 'antd';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetch('/backend/auth/setup').then((r) => r.ok ? r.json() : null).then((d) => setNeedsSetup(d?.setupDone === false)).catch(() => {});
  }, []);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { ...values, redirect: false });
    if (res?.ok) {
      router.replace('/dashboard');
      router.refresh();
    } else {
      setError(res?.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backgroundImage: 'radial-gradient(circle, #d0d7e3 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <Card style={{ maxWidth: 400, width: '100%', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,.10)' }}
        styles={{ body: { padding: '32px 32px 24px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>StockHV</div>
            <div style={{ fontSize: 12, color: '#888' }}>ระบบบริหารคลังยาและเวชภัณฑ์</div>
          </div>
        </div>

        {needsSetup && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message={<>ยังไม่มีผู้ใช้ในระบบ — <Link href="/setup">ตั้งค่าครั้งแรก</Link></>} />
        )}
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" label="อีเมล" rules={[{ required: true, type: 'email', message: 'กรุณากรอกอีเมล' }]}>
            <Input size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>เข้าสู่ระบบ</Button>
        </Form>
      </Card>
    </div>
  );
}
