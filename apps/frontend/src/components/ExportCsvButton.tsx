'use client';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportToCsv, CsvColumn } from '@/lib/csvExport';

interface Props {
  filename: string;
  rows: Record<string, any>[];
  columns: CsvColumn[];
  label?: string;
}

export default function ExportCsvButton({ filename, rows, columns, label = 'Export CSV' }: Props) {
  return (
    <Button icon={<DownloadOutlined />} disabled={!rows.length} onClick={() => exportToCsv(filename, rows, columns)}>
      {label}
    </Button>
  );
}
