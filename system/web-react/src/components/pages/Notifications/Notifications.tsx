import { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { notificationApi } from '../../../api/notifications';
import type { Notification } from '../../../types';
import Loading from '../../common/Loading';
import EmptyState from '../../common/EmptyState';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, string> = {
  task_assigned: '📌', task_accepted: '✅', task_rejected: '❌', task_completed: '🎉',
  review_completed: '📄', approval_requested: '📋', approval_result: '🔔',
  comment_added: '💬', escalation_updated: '🔄', deadline_reminder: '⏰',
};

export default function Notifications() {
  const { showToast } = useToast();
  const { refreshCount } = useNotifications();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifs(); }, []);

  async function loadNotifs() {
    setLoading(true);
    try {
      const data = await notificationApi.list();
      setNotifs(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载通知失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(notif: Notification) {
    if (!notif.is_read) {
      try { await notificationApi.markRead(notif.notification_id); refreshCount(); } catch { /* ok */ }
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead();
      refreshCount();
      loadNotifs();
      showToast('已全部标记为已读', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  }

  return (
    <div className="page-section" data-section="notifications">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div>
          <h2 className="page-title">通知中心</h2>
          <p className="page-desc">系统消息和任务动态</p>
        </div>
        <button className="btn btn-sm btn-outline" onClick={markAllRead}>全部已读</button>
      </div>

      {loading ? <Loading /> : notifs.length === 0 ? (
        <EmptyState icon="🔔" title="暂无通知" description="当有新的任务或动态时，会在这里显示" />
      ) : (
        <div className="card" style={{ padding:0 }}>
          {notifs.map(n => (
            <div key={n.notification_id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => handleClick(n)}>
              <span className="notif-icon">{TYPE_ICONS[n.notification_type] || '📢'}</span>
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                <div className="notif-text">{n.body}</div>
                <div className="notif-time">{new Date(n.created_at).toLocaleString('zh-CN')}</div>
              </div>
              {!n.is_read && <span className="notif-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
