'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { App, Button, Card, Col, DatePicker, Empty, Progress, Row, Statistic, Table, Tag } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useApi } from '@/lib/api';
import { TX_TYPE, isManager } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';

interface Stats {
  itemCount: number;
  lowStockCount: number;
  pendingAdjCount: number;
  expiringLotCount: number;
  lowStockItems: { id: string; name: string; unit: string; currentStock: number; lowStockThreshold: number }[];
  movements: { type: string; count: number; quantity: number }[];
}

export default function DashboardPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const { request, ready } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')]);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      setStats(await request<Stats>(`/dashboard?from=${range[0].toISOString()}&to=${range[1].toISOString()}`));
    } catch (err: any) {
      message.error(err.message);
    }
  }, [ready, request, range, message]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`สวัสดี ${session?.displayName ?? ''}`}
        extra={
          <DatePicker.RangePicker value={range} format="DD MMM YY" allowClear={false}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0].startOf('day'), v[1].endOf('day')])} />
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="รายการทั้งหมด" value={stats?.itemCount ?? '-'} suffix="รายการ" /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="ใกล้หมด" value={stats?.lowStockCount ?? '-'} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lot ใกล้หมดอายุ" value={stats?.expiringLotCount ?? '-'} valueStyle={{ color: '#d46b08' }} /></Card></Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="รออนุมัติปรับยอด" value={stats?.pendingAdjCount ?? '-'} valueStyle={{ color: '#d48806' }} />
            {isManager(session?.role) && !!stats?.pendingAdjCount && <Link href="/approvals" style={{ fontSize: 12 }}>ไปที่หน้าอนุมัติ →</Link>}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="รายการใกล้หมด" extra={<Link href="/inventory"><Button size="small" type="primary">จัดการคลัง</Button></Link>}>
            {stats && stats.lowStockItems.length === 0 ? <Empty description="ไม่มีรายการใกล้หมด" /> : (stats?.lowStockItems ?? []).map((i) => {
              const pct = Math.min(100, Math.round((i.currentStock / Math.max(i.lowStockThreshold, 1)) * 100));
              return (
                <div key={i.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{i.name}</span>
                    <span style={{ color: '#cf1322' }}>{i.currentStock} / {i.lowStockThreshold} {i.unit}</span>
                  </div>
                  <Progress percent={pct} showInfo={false} size="small" strokeColor={pct <= 30 ? '#cf1322' : '#faad14'} />
                </div>
              );
            })}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="ความเคลื่อนไหวในช่วงที่เลือก">
            <Table
              size="small" pagination={false} rowKey="type" dataSource={stats?.movements ?? []}
              locale={{ emptyText: 'ไม่มีความเคลื่อนไหว' }}
              columns={[
                { title: 'ประเภท', dataIndex: 'type', render: (t) => <Tag color={TX_TYPE[t]?.color}>{TX_TYPE[t]?.label ?? t}</Tag> },
                { title: 'ครั้ง', dataIndex: 'count', align: 'right' },
                {
                  title: 'จำนวนรวม', dataIndex: 'quantity', align: 'right',
                  render: (v) => <b style={{ color: v > 0 ? '#389e0d' : '#cf1322' }}>{v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()}</b>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
