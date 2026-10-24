'use client';
import { useCallback, useEffect, useState } from 'react';
import { App, Card, Table, Tag } from 'antd';
import { useApi } from '@/lib/api';
import { formatDate } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';

interface Log {
  id: string; action: string; entity: string; detail: string | null; createdAt: string;
  actor: { displayName: string };
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { message } = App.useApp();
  const { request, ready } = useApi();
  const [data, setData] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const res = await request<{ data: Log[]; total: number }>(`/audit-logs?skip=${(page - 1) * PAGE_SIZE}&limit=${PAGE_SIZE}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [ready, request, page, message]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Audit Log" />
      <Card>
        <Table
          dataSource={data} rowKey="id" loading={loading} size="small" scroll={{ x: 640 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
          columns={[
            { title: 'เวลา', dataIndex: 'createdAt', width: 140, render: (v) => formatDate(v, true) },
            { title: 'ผู้ทำ', key: 'actor', width: 140, render: (_, r) => r.actor.displayName },
            { title: 'การกระทำ', dataIndex: 'action', width: 140, render: (v) => <Tag>{v}</Tag> },
            { title: 'รายละเอียด', dataIndex: 'detail', render: (v) => v ?? '—' },
          ]}
        />
      </Card>
    </div>
  );
}
