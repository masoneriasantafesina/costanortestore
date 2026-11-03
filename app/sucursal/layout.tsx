import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pedido para sucursal',
  robots: { index: false, follow: false },
};

export default function SucursalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
