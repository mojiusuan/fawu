import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { Role } from '../../types';

interface NavItem {
  page: string;
  label: string;
  icon: string;
  roles: Role[];
  badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'home', label: '系统首页', icon: '🏠', roles: ['admin', 'legal', 'business', 'auditor'] },
  { page: 'case-center', label: '案件中心', icon: '📋', roles: ['admin', 'legal', 'business', 'auditor'] },
  { page: 'contract', label: '合同管理', icon: '📄', roles: ['admin', 'legal', 'business'] },
  { page: 'consultation', label: '智能咨询', icon: '💬', roles: ['admin', 'legal', 'business', 'auditor'] },
  { page: 'tasks', label: '任务看板', icon: '📌', roles: ['admin', 'legal', 'business', 'auditor'], badge: true },
  { page: 'kg', label: '知识图谱', icon: '🔗', roles: ['admin', 'legal'] },
  { page: 'templates', label: '文书模板', icon: '📝', roles: ['admin', 'legal', 'business', 'auditor'] },
  { page: 'calculators', label: '计算工具', icon: '🔢', roles: ['admin', 'legal', 'business', 'auditor'] },
  { page: 'audit', label: '审计报告', icon: '🔍', roles: ['admin', 'auditor'] },
  { page: 'rpa', label: '自动化工具', icon: '🤖', roles: ['admin', 'legal'] },
  { page: 'settings', label: '系统设置', icon: '⚙️', roles: ['admin'] },
];

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ currentPage, onNavigate, mobileOpen, onMobileClose }: Props) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const handleNav = (page: string) => {
    onNavigate(page);
    onMobileClose();
  };

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚖️</span>
            <span className="logo-text">智能法务系统</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map(item => (
            <button
              key={item.page}
              className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
              onClick={() => handleNav(item.page)}
              data-page={item.page}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              <div className="user-avatar">{user.display_name.charAt(0)}</div>
              <div className="user-details">
                <div className="user-name">{user.display_name}</div>
                <div className={`role-tag role-${user.role}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </div>
              </div>
              <button className="logout-btn" onClick={logout} title="退出登录">
                ⏻
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  legal: '法务人员',
  business: '业务人员',
  auditor: '审计员',
};
