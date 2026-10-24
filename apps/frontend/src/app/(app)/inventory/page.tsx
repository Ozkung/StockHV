'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Alert, App, Button, Card, DatePicker, Drawer, Dropdown, Form, Input, InputNumber,
  Modal, Popconfirm, Segmented, Select, Table, Tabs, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AlertTriangle, Clock, MoreHorizontal, PackageX } from 'lucide-react';
import { useApi } from '@/lib/api';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CATEGORY_LABEL, TX_TYPE, UNITS, formatDate, isManager } from '@/lib/constants';
import PageHeader from '@/components/PageHeader';
import ExportCsvButton from '@/components/ExportCsvButton';

interface Item {
  id: string; name: string; unit: string; category: 'DRUG' | 'SUPPLY';
  currentStock: number; lowStockThreshold: number;
}

interface ExpiringLot {
  lotId: string; itemId: string; itemName: string; unit: string;
  remaining: number; expiryDate: string; daysLeft: number;
}

interface StockTx {
  id: string; type: string; quantity: number; balanceAfter: number; createdAt: string;
  reference: string | null; reason: string | null; receiptNo: string | null; donorName: string | null;
  actor: { displayName: string }; lot: { expiryDate: string } | null;
}

interface Lot {
  id: string; quantity: number; remaining: number; expiryDate: string; receivedAt: string;
  receiptNo: string | null; donorName: string | null; unitCost: number | null; isExpired: boolean;
  actor: { displayName: string };
}

type ModalKind = 'item' | 'stockIn' | 'deduct' | 'adj';

const CSV_COLUMNS = [
  { key: 'name', label: 'ชื่อรายการ' },
  { key: 'categoryLabel', label: 'หมวดหมู่' },
  { key: 'currentStock', label: 'คงเหลือ' },
  { key: 'unit', label: 'หน่วย' },
  { key: 'lowStockThreshold', label: 'เกณฑ์แจ้งเตือน' },
];

export default function InventoryPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const { request, ready } = useApi();
  const isMobile = useIsMobile();
  const manager = isManager(session?.role);

  const [items, setItems] = useState<Item[]>([]);
  const [expiring, setExpiring] = useState<ExpiringLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'ALL' | 'DRUG' | 'SUPPLY'>('ALL');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const [modal, setModal] = useState<{ kind: ModalKind; item?: Item } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [expiryOpen, setExpiryOpen] = useState(false);
  const [detail, setDetail] = useState<Item | null>(null);
  const [txList, setTxList] = useState<StockTx[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const [i, e] = await Promise.all([request<Item[]>('/inventory'), request<ExpiringLot[]>('/inventory/expiring')]);
      setItems(i);
      setExpiring(e);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [ready, request, message]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter((i) =>
    (category === 'ALL' || i.category === category) &&
    (!lowOnly || i.currentStock <= i.lowStockThreshold) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase())),
  ), [items, category, lowOnly, search]);

  const expiringByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of expiring) m.set(l.itemId, (m.get(l.itemId) ?? 0) + 1);
    return m;
  }, [expiring]);

  function openModal(kind: ModalKind, item?: Item) {
    form.resetFields();
    if (kind === 'item') {
      form.setFieldsValue(item ?? { category: category === 'ALL' ? 'DRUG' : category, lowStockThreshold: 10 });
    } else if (kind === 'stockIn') {
      form.setFieldsValue({ type: 'IN_PURCHASE' });
    } else if (kind === 'deduct') {
      form.setFieldsValue({ type: item?.category === 'SUPPLY' ? 'OUT_SUPPLY' : 'OUT_PRESCRIPTION' });
    }
    setModal({ kind, item });
  }

  async function submitModal() {
    if (!modal) return;
    const values = await form.validateFields();
    const { kind, item } = modal;
    setSaving(true);
    try {
      if (kind === 'item') {
        await request(item ? `/inventory/${item.id}` : '/inventory', { method: item ? 'PATCH' : 'POST', body: values });
        message.success(item ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว');
      } else if (kind === 'stockIn') {
        await request(`/inventory/${item!.id}/stock-in`, {
          method: 'POST',
          body: { ...values, expiryDate: (values.expiryDate as dayjs.Dayjs).format('YYYY-MM-DD') },
        });
        message.success('รับเข้าสต็อกแล้ว');
      } else if (kind === 'deduct') {
        const res = await request<{ balanceAfter: number; lowStock: boolean }>(`/inventory/${item!.id}/deduct`, { method: 'POST', body: values });
        if (res.lowStock) message.warning(`ตัดสต็อกแล้ว — คงเหลือ ${res.balanceAfter} ${item!.unit} (ต่ำกว่าเกณฑ์)`);
        else message.success(`ตัดสต็อกแล้ว — คงเหลือ ${res.balanceAfter} ${item!.unit}`);
      } else if (kind === 'adj') {
        const res = await request<{ autoApproved: boolean }>(`/inventory/${item!.id}/adj-request`, { method: 'POST', body: values });
        message.success(res.autoApproved ? 'ปรับยอดแล้ว' : 'ส่งคำขอปรับยอดแล้ว — รอผู้อนุมัติ');
      }
      setModal(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive(item: Item) {
    try {
      await request(`/inventory/${item.id}`, { method: 'DELETE' });
      message.success('เก็บรายการแล้ว');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  }

  async function expireLot(lotId: string) {
    try {
      await request(`/inventory/lots/${lotId}/expire`, { method: 'POST' });
      message.success('นำ lot ออกจากสต็อกแล้ว');
      load();
      if (detail) openDetail(detail);
    } catch (err: any) {
      message.error(err.message);
    }
  }

  async function openDetail(item: Item) {
    setDetail(item);
    setDetailLoading(true);
    try {
      const [t, l] = await Promise.all([
        request<StockTx[]>(`/inventory/${item.id}/transactions`),
        request<Lot[]>(`/inventory/${item.id}/lots`),
      ]);
      setTxList(t);
      setLots(l);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns: ColumnsType<Item> = [
    {
      title: 'ชื่อรายการ', dataIndex: 'name', key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, r) => {
        const near = expiringByItem.get(r.id) ?? 0;
        return (
          <div>
            <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => openDetail(r)}>{name}</Button>
            {r.currentStock <= r.lowStockThreshold && <Tag color="error" style={{ marginLeft: 8, fontSize: 10 }}>ใกล้หมด</Tag>}
            {near > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Clock size={11} color="#fa541c" />
                <span style={{ fontSize: 11, color: '#fa541c' }}>{near} lot ใกล้หมดอายุ</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'หมวด', dataIndex: 'category', key: 'category', width: 100, responsive: ['md'],
      render: (c) => <Tag>{CATEGORY_LABEL[c] ?? c}</Tag>,
    },
    {
      title: 'คงเหลือ', dataIndex: 'currentStock', key: 'currentStock', width: 120,
      sorter: (a, b) => a.currentStock - b.currentStock,
      render: (n, r) => (
        <span style={{ fontWeight: 700, color: n <= r.lowStockThreshold ? '#cf1322' : n <= r.lowStockThreshold * 2 ? '#d48806' : '#389e0d' }}>
          {n.toLocaleString()} <span style={{ fontWeight: 400, color: '#888' }}>{r.unit}</span>
        </span>
      ),
    },
    { title: 'เกณฑ์', dataIndex: 'lowStockThreshold', key: 'lowStockThreshold', width: 80, responsive: ['md'] },
    {
      title: '', key: 'actions', width: manager ? 250 : 130, align: 'right',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {manager && <Button size="small" type="primary" onClick={() => openModal('stockIn', r)}>รับเข้า</Button>}
          <Button size="small" onClick={() => openModal('deduct', r)}>จ่าย/เบิก</Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'detail', label: 'ประวัติ & Lots', onClick: () => openDetail(r) },
                ...(manager ? [
                  { key: 'adj', label: 'ปรับยอด (ADJ)', onClick: () => openModal('adj', r) },
                  { key: 'edit', label: 'แก้ไขรายการ', onClick: () => openModal('item', r) },
                  { type: 'divider' as const },
                  {
                    key: 'archive', danger: true, disabled: r.currentStock > 0,
                    label: r.currentStock > 0 ? 'เก็บรายการ (ต้องมียอด 0)' : 'เก็บรายการ',
                    onClick: () => Modal.confirm({
                      title: `เก็บรายการ "${r.name}"?`, content: 'รายการจะถูกซ่อนจากคลัง ประวัติยังคงอยู่',
                      okText: 'เก็บ', okButtonProps: { danger: true }, cancelText: 'ยกเลิก', onOk: () => archive(r),
                    }),
                  },
                ] : []),
              ],
            }}
          >
            <Button size="small" icon={<MoreHorizontal size={14} />} aria-label="เพิ่มเติม" />
          </Dropdown>
        </div>
      ),
    },
  ];

  const modalTitle: Record<ModalKind, string> = {
    item: modal?.item ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่',
    stockIn: `รับเข้า — ${modal?.item?.name ?? ''}`,
    deduct: `จ่าย / เบิก — ${modal?.item?.name ?? ''}`,
    adj: `ปรับยอด — ${modal?.item?.name ?? ''}`,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="คลังยา & เวชภัณฑ์"
        extra={<>
          <ExportCsvButton filename={`inventory-${dayjs().format('YYYYMMDD')}`} columns={CSV_COLUMNS}
            rows={filtered.map((i) => ({ ...i, categoryLabel: CATEGORY_LABEL[i.category] }))} />
          {manager && <Button type="primary" onClick={() => openModal('item')}>+ เพิ่มรายการ</Button>}
        </>}
      />

      {expiring.length > 0 && (
        <Alert
          type="warning" showIcon icon={<AlertTriangle size={16} />} style={{ marginBottom: 16 }}
          message={`มี ${expiring.length} lot ใกล้หมดอายุหรือหมดอายุแล้ว`}
          action={<Button size="small" onClick={() => setExpiryOpen(true)}>ดูรายละเอียด</Button>}
        />
      )}

      <Card styles={{ body: { padding: isMobile ? 12 : '16px 24px' } }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented
            value={category} onChange={(v) => setCategory(v as typeof category)}
            options={[{ label: 'ทั้งหมด', value: 'ALL' }, { label: 'ยา', value: 'DRUG' }, { label: 'เวชภัณฑ์', value: 'SUPPLY' }]}
          />
          <Input.Search placeholder="ค้นหาชื่อ..." allowClear style={{ maxWidth: 260 }}
            onSearch={setSearch} onChange={(e) => !e.target.value && setSearch('')} />
          <Button type={lowOnly ? 'primary' : 'default'} danger={lowOnly} onClick={() => setLowOnly((v) => !v)}>
            เฉพาะใกล้หมด
          </Button>
        </div>
        <Table
          columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'ยังไม่มีรายการ' }}
          rowClassName={(r) => (r.currentStock <= r.lowStockThreshold ? 'row-low-stock' : '')}
          scroll={{ x: 520 }}
        />
      </Card>

      <Modal title={modal ? modalTitle[modal.kind] : ''} open={!!modal} onOk={submitModal} confirmLoading={saving}
        onCancel={() => setModal(null)} okText="บันทึก" cancelText="ยกเลิก" destroyOnHidden>
        <Form form={form} layout="vertical" preserve={false}>
          {modal?.kind === 'item' && <>
            <Form.Item name="name" label="ชื่อรายการ" rules={[{ required: true, whitespace: true }]}>
              <Input placeholder="เช่น Paracetamol 500mg" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="unit" label="หน่วย" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select showSearch options={UNITS.map((u) => ({ value: u, label: u }))} />
              </Form.Item>
              <Form.Item name="category" label="หมวดหมู่" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select options={[{ value: 'DRUG', label: 'ยา' }, { value: 'SUPPLY', label: 'เวชภัณฑ์' }]} />
              </Form.Item>
            </div>
            <Form.Item name="lowStockThreshold" label="แจ้งเตือนเมื่อคงเหลือไม่เกิน" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </>}

          {modal?.kind === 'stockIn' && <>
            <Form.Item name="type" label="ประเภทการรับเข้า" rules={[{ required: true }]}>
              <Select options={[{ value: 'IN_PURCHASE', label: 'ซื้อเข้า' }, { value: 'IN_DONATION', label: 'บริจาค' }]} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.type !== c.type}>
              {({ getFieldValue }) => getFieldValue('type') === 'IN_DONATION' && (
                <Form.Item name="donorName" label="ผู้บริจาค"><Input placeholder="ชื่อผู้บริจาค / องค์กร" /></Form.Item>
              )}
            </Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="quantity" label={`จำนวน (${modal.item?.unit})`} rules={[{ required: true }]} style={{ flex: 1 }}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="expiryDate" label="วันหมดอายุ" rules={[{ required: true }]} style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(d) => d.isBefore(dayjs().add(1, 'day'), 'day')} />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="receiptNo" label="เลขที่ใบเสร็จ" style={{ flex: 1 }}><Input /></Form.Item>
              <Form.Item name="unitCost" label="ราคาต่อหน่วย (บาท)" style={{ flex: 1 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          </>}

          {modal?.kind === 'deduct' && <>
            <Alert type="info" style={{ marginBottom: 16 }} message={`คงเหลือ ${modal.item?.currentStock} ${modal.item?.unit} — ตัดจาก lot ที่หมดอายุก่อน`} />
            <Form.Item name="type" label="ประเภท" rules={[{ required: true }]}>
              <Select options={[{ value: 'OUT_PRESCRIPTION', label: 'จ่ายยา' }, { value: 'OUT_SUPPLY', label: 'เบิกใช้' }]} />
            </Form.Item>
            <Form.Item name="quantity" label={`จำนวน (${modal.item?.unit})`} rules={[{ required: true }]}>
              <InputNumber min={1} max={modal.item?.currentStock} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reference" label="จ่ายให้ / อ้างอิง">
              <Input placeholder="เช่น HN ผู้ป่วย, ชื่องาน, แผนก" />
            </Form.Item>
            <Form.Item name="reason" label="หมายเหตุ"><Input /></Form.Item>
          </>}

          {modal?.kind === 'adj' && <>
            <Alert type="info" style={{ marginBottom: 16 }}
              message={`คงเหลือ ${modal.item?.currentStock} ${modal.item?.unit}`}
              description="ปรับยอดจำนวนมากต้องให้ผู้จัดการคลังหรือผู้ดูแลระบบอีกคนอนุมัติ" />
            <Form.Item name="quantity" label="จำนวน (ติดลบ = ลด, บวก = เพิ่ม)"
              rules={[{ required: true }, { validator: (_, v) => (v === 0 ? Promise.reject(new Error('ต้องไม่เป็น 0')) : Promise.resolve()) }]}>
              <InputNumber precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reason" label="เหตุผล" rules={[{ required: true, whitespace: true }]}>
              <Input.TextArea rows={3} placeholder="เช่น ตรวจนับผิดพลาด, ชำรุด, สูญหาย" />
            </Form.Item>
          </>}
        </Form>
      </Modal>

      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color="#faad14" />Lot ใกล้หมดอายุ</span>}
        open={expiryOpen} onCancel={() => setExpiryOpen(false)} footer={null} width={isMobile ? '100%' : 720}
      >
        <Table
          dataSource={expiring} rowKey="lotId" size="small" pagination={false} scroll={{ x: 520 }}
          columns={[
            { title: 'รายการ', dataIndex: 'itemName', render: (v) => <b>{v}</b> },
            { title: 'คงเหลือ', dataIndex: 'remaining', width: 100, render: (v, r) => `${v} ${r.unit}` },
            { title: 'หมดอายุ', dataIndex: 'expiryDate', width: 110, render: (v) => formatDate(v) },
            {
              title: 'เหลือ', dataIndex: 'daysLeft', width: 90,
              render: (v) => <Tag color={v <= 0 ? 'error' : v <= 7 ? 'warning' : 'orange'}>{v <= 0 ? 'หมดแล้ว' : `${v} วัน`}</Tag>,
            },
            ...(manager ? [{
              title: '', key: 'action', width: 90,
              render: (_: unknown, r: ExpiringLot) => (
                <Popconfirm title="นำ lot นี้ออกจากสต็อก?" description={`ตัด ${r.remaining} ${r.unit} ออก`}
                  okText="ยืนยัน" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => expireLot(r.lotId)}>
                  <Button size="small" danger icon={<PackageX size={13} />}>นำออก</Button>
                </Popconfirm>
              ),
            }] : []),
          ]}
        />
      </Modal>

      <Drawer title={detail?.name} open={!!detail} onClose={() => setDetail(null)} width={isMobile ? '100%' : 760}>
        <Tabs items={[
          {
            key: 'tx', label: 'ความเคลื่อนไหว',
            children: (
              <Table
                dataSource={txList} rowKey="id" size="small" loading={detailLoading} scroll={{ x: 620 }} pagination={{ pageSize: 20 }}
                columns={[
                  { title: 'วันที่', dataIndex: 'createdAt', width: 130, render: (v) => formatDate(v, true) },
                  { title: 'ประเภท', dataIndex: 'type', width: 100, render: (t) => <Tag color={TX_TYPE[t]?.color}>{TX_TYPE[t]?.label ?? t}</Tag> },
                  {
                    title: 'จำนวน', dataIndex: 'quantity', width: 80,
                    render: (v) => <b style={{ color: v > 0 ? '#389e0d' : '#cf1322' }}>{v > 0 ? `+${v}` : v}</b>,
                  },
                  { title: 'คงเหลือ', dataIndex: 'balanceAfter', width: 80 },
                  {
                    title: 'รายละเอียด', key: 'detail',
                    render: (_, r) => [r.reference && `→ ${r.reference}`, r.donorName, r.receiptNo, r.reason].filter(Boolean).join(' · ') || '—',
                  },
                  { title: 'โดย', key: 'actor', width: 120, render: (_, r) => r.actor.displayName },
                ]}
              />
            ),
          },
          {
            key: 'lots', label: `Lots (${lots.filter((l) => !l.isExpired && l.remaining > 0).length})`,
            children: (
              <Table
                dataSource={lots} rowKey="id" size="small" loading={detailLoading} scroll={{ x: 620 }} pagination={false}
                rowClassName={(r) => (r.isExpired || r.remaining === 0 ? 'row-muted' : '')}
                columns={[
                  { title: 'หมดอายุ', dataIndex: 'expiryDate', width: 110, render: (v) => formatDate(v) },
                  { title: 'รับเข้า', dataIndex: 'receivedAt', width: 110, render: (v) => formatDate(v) },
                  { title: 'คงเหลือ / รับ', key: 'qty', width: 110, render: (_, r) => `${r.remaining} / ${r.quantity}` },
                  { title: 'ใบเสร็จ / ผู้บริจาค', key: 'src', render: (_, r) => [r.receiptNo, r.donorName].filter(Boolean).join(' · ') || '—' },
                  {
                    title: 'สถานะ', key: 'status', width: 120,
                    render: (_, r) => r.isExpired ? <Tag color="red">นำออกแล้ว</Tag>
                      : r.remaining === 0 ? <Tag>ใช้หมดแล้ว</Tag>
                      : manager && dayjs(r.expiryDate).isBefore(dayjs().add(30, 'day')) ? (
                        <Popconfirm title="นำ lot นี้ออกจากสต็อก?" okText="ยืนยัน" cancelText="ยกเลิก"
                          okButtonProps={{ danger: true }} onConfirm={() => expireLot(r.id)}>
                          <Button size="small" danger>นำออก</Button>
                        </Popconfirm>
                      ) : <Tag color="green">ใช้งาน</Tag>,
                  },
                ]}
              />
            ),
          },
        ]} />
      </Drawer>
    </div>
  );
}
