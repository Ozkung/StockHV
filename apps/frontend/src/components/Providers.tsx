'use client';
import { App, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConfigProvider
        locale={thTH}
        theme={{
          token: {
            colorPrimary: '#0f766e',
            colorLink: '#0f766e',
            borderRadius: 10,
            fontFamily: "'Sarabun', sans-serif",
            colorBgLayout: '#f0f2f5',
          },
          components: {
            Card: { borderRadiusLG: 14 },
            Table: { borderRadiusLG: 14 },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </SessionProvider>
  );
}
