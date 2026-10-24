'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { App, Button, Card, Empty, Input, Segmented, Table, Tag, Typography } from 'antd';
import { useApi } from '@/lib/api';
import { formatDate } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;

interface AdjRequest {
  id: string; quantity: number; reason: string; createdAt: string; requestedById: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote: string | null;
  item: { name: string; unit: string; currentStock: number };
  requester: { displayName: string };
  reviewer: { displayName: string } | null;
}

const STATUS_TAG: Record<string, [string, string]> = {
  PENDING: ['gold', 'รออนุมัติ'], APPROVED: ['green', 'อนุมัติ'], REJECTED: ['red', 'ปฏิเสธ'],
};

export default function ApprovalsPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const { request, ready } = useApi();
  const [view, setView] = useState<'PENDING' | 'ALL'>('PENDING');
  const [requests, setRequests] = useState<AdjRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      setRequests(await request<AdjRequest[]>(`/inventory/adj-requests?status=${view}`));
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [ready, request, view, message]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    setProcessing(id);
    try {
      await request(`/inventory/adj-requests/${id}`, { method: 'PATCH', body: { status, reviewNote: notes[id] || undefined } });
      message.success(status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Adjustments" title="อนุมัติปรับยอด"
        extra={<Segmented value={view} onChange={(v) => setView(v as typeof view)}
          options={[{ label: 'รออนุมัติ', value: 'PENDING' }, { label: 'ทั้งหมด', value: 'ALL' }]} />} />

      {view === 'PENDING' ? (
        loading ? <Card loading /> : requests.length === 0 ? <Card><Empty description="ไม่มีคำขอรออนุมัติ" /></Card> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {requests.map((r) => {
              const own = r.requestedById === session?.userId;
              return (
                <Card key={r.id} styles={{ body: { padding: 16 } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <Text strong>{r.item.name}</Text>
                      <Tag color={r.quantity > 0 ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                        {r.quantity > 0 ? `+${r.quantity}` : r.quantity} {r.item.unit}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.createdAt, true)}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>เหตุผล: {r.reason}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>คงเหลือปัจจุบัน: {r.item.currentStock} {r.item.unit}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>ขอโดย: {r.requester.displayName}</Text>
                  {own ? (
                    <Text type="warning" style={{ fontSize: 12 }}>คำขอของคุณ — ต้องให้ผู้อื่นอนุมัติ</Text>
                  ) : <>
                    <Input size="small" placeholder="หมายเหตุ (ถ้ามี)" style={{ marginBottom: 8 }}
                      value={notes[r.id] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="primary" size="small" style={{ flex: 1 }} loading={processing === r.id} onClick={() => review(r.id, 'APPROVED')}>✓ อนุมัติ</Button>
                      <Button danger size="small" style={{ flex: 1 }} loading={processing === r.id} onClick={() => review(r.id, 'REJECTED')}>✕ ปฏิเสธ</Button>
                    </div>
                  </>}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card>
          <Table
            dataSource={requests} rowKey="id" loading={loading} size="small" scroll={{ x: 760 }}
            columns={[
              { title: 'วันที่', dataIndex: 'createdAt', width: 130, render: (v) => formatDate(v, true) },
              { title: 'รายการ', key: 'item', render: (_, r) => r.item.name },
              { title: 'จำนวน', dataIndex: 'quantity', width: 90, render: (v, r) => `${v > 0 ? '+' : ''}${v} ${r.item.unit}` },
              { title: 'เหตุผล', dataIndex: 'reason' },
              { title: 'ผู้ขอ', key: 'req', width: 120, render: (_, r) => r.requester.displayName },
              { title: 'สถานะ', dataIndex: 'status', width: 90, render: (s) => <Tag color={STATUS_TAG[s][0]}>{STATUS_TAG[s][1]}</Tag> },
              { title: 'ผู้พิจารณา', key: 'rev', width: 140, render: (_, r) => r.reviewer ? `${r.reviewer.displayName}${r.reviewNote ? ` — ${r.reviewNote}` : ''}` : '—' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
