import { Typography } from 'antd';
import type { ReactNode } from 'react';

export default function PageHeader({ eyebrow, title, extra }: { eyebrow: string; title: string; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 10, color: '#0f766e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>{eyebrow}</div>
        <Typography.Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: -1 }}>{title}</Typography.Title>
      </div>
      {extra && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{extra}</div>}
    </div>
  );
}
