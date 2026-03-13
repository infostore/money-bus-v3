import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Package,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Settings,
  HelpCircle,
  Users,
  Building2,
  Landmark,
  CalendarClock,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly path: string
}

export interface NavGroup {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'overview',
    label: '개요',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    id: 'assets',
    label: '자산 관리',
    icon: Wallet,
    items: [
      { id: 'portfolio', label: '포트폴리오', icon: PieChart, path: '/portfolio' },
      { id: 'products', label: '종목 관리', icon: Package, path: '/products' },
    ],
  },
  {
    id: 'analysis',
    label: '분석',
    icon: BarChart3,
    items: [
      { id: 'analysis', label: '종목 분석', icon: BarChart3, path: '/analysis' },
    ],
  },
  {
    id: 'planning',
    label: '재무 계획',
    icon: TrendingUp,
    items: [
      { id: 'planning', label: '재무 목표', icon: TrendingUp, path: '/planning' },
    ],
  },
  {
    id: 'tax',
    label: '세금',
    icon: ShieldCheck,
    items: [
      { id: 'tax', label: '세금 허브', icon: ShieldCheck, path: '/tax' },
    ],
  },
  {
    id: 'scheduler',
    label: '스케줄러',
    icon: CalendarClock,
    items: [
      { id: 'price-collection', label: '가격수집', icon: Timer, path: '/scheduler/price-collection' },
    ],
  },
  {
    id: 'system',
    label: '시스템',
    icon: Settings,
    items: [
      { id: 'family-members', label: '가족구성원', icon: Users, path: '/family-members' },
      { id: 'accounts', label: '계좌', icon: Wallet, path: '/accounts' },
      { id: 'institutions', label: '금융기관', icon: Building2, path: '/institutions' },
      { id: 'account-types', label: '계좌유형', icon: Landmark, path: '/account-types' },
      { id: 'settings', label: '설정', icon: Settings, path: '/settings' },
      { id: 'help', label: '도움말', icon: HelpCircle, path: '/help' },
    ],
  },
]

export function findGroupForPath(pathname: string): string {
  return NAV_GROUPS.find((g) =>
    g.items.some((i) => pathname.startsWith(i.path)),
  )?.id ?? 'overview'
}
