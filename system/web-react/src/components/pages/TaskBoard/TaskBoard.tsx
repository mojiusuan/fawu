import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { taskApi } from '../../../api/tasks';
import { authApi } from '../../../api/auth';
import type { Task, UserInfo } from '../../../types';
import Loading from '../../common/Loading';
import EmptyState from '../../common/EmptyState';

type FilterView = 'my_tasks' | 'created_by_me';

const TASK_TYPES: { value: string; label: string }[] = [
  { value: 'contract_review', label: '合同审查' },
  { value: 'case_review', label: '案件分析' },
  { value: 'consultation_response', label: '咨询回复' },
  { value: 'document_draft', label: '文书起草' },
  { value: 'escalation_handle', label: '转接处理' },
  { value: 'general', label: '其他' },
];

export default function TaskBoard() {
  const { user, hasRole } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<FilterView>('my_tasks');
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Create form state
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Confirm action dialog for reject/complete
  const [actionDialog, setActionDialog] = useState<{ taskId: string; action: 'reject' | 'complete' } | null>(null);
  const [actionNote, setActionNote] = useState('');

  useEffect(() => { loadTasks(); }, [view]);
  useEffect(() => { if (showCreate) loadUsers(); }, [showCreate]);

  async function loadTasks() {
    setLoading(true);
    try {
      const data = await taskApi.list({ filter: view });
      setTasks(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载任务失败', 'error');
    } finally { setLoading(false); }
  }

  async function loadUsers() {
    try {
      const token = JSON.parse(localStorage.getItem('auth_token') || 'null');
      const res = await fetch('/api/auth/assignable-users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const all = await res.json();
        setUsers(all);
      }
    } catch { /* silent */ }
  }

  async function handleCreate() {
    if (!title.trim()) { showToast('请输入任务标题', 'warning'); return; }
    if (!assignedTo) { showToast('请选择负责人', 'warning'); return; }
    setCreating(true);
    try {
      await taskApi.create({
        title: title.trim(),
        task_type: taskType,
        priority: priority as any,
        assigned_to: assignedTo,
        description: description.trim() || undefined,
      });
      showToast('任务创建成功', 'success');
      setShowCreate(false);
      setTitle(''); setTaskType('general'); setPriority('normal');
      setAssignedTo(''); setDescription('');
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '创建失败', 'error');
    } finally { setCreating(false); }
  }

  function promptAction(taskId: string, action: 'reject' | 'complete') {
    setActionDialog({ taskId, action });
    setActionNote('');
  }

  async function confirmAction() {
    if (!actionDialog) return;
    const { taskId, action } = actionDialog;
    try {
      let result: Task | undefined;
      if (action === 'reject') result = await taskApi.reject(taskId, actionNote.trim() || undefined);
      else result = await taskApi.complete(taskId, actionNote.trim() || undefined);
      showToast(action === 'reject' ? '已拒绝任务' : '任务已完成', 'success');
      if (result && detailTask?.task_id === taskId) setDetailTask(result);
      setActionDialog(null);
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  }

  async function handleAction(taskId: string, action: 'accept') {
    try {
      const result = await taskApi.accept(taskId);
      showToast('已接受任务', 'success');
      if (result && detailTask?.task_id === taskId) setDetailTask(result);
      loadTasks();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  }

  function openDetail(task: Task) {
    setDetailTask(task);
  }

  const STATUS_LABELS: Record<string, string> = {
    pending: '待处理', accepted: '已接受', in_progress: '进行中',
    completed: '已完成', rejected: '已拒绝', cancelled: '已取消',
  };
  const PRIORITY_LABELS: Record<string, string> = {
    low: '低', normal: '普通', urgent: '紧急', critical: '严重',
  };

  return (
    <div className="page-section">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 className="page-title">任务看板</h2>
          <p className="page-desc">团队协作任务管理</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowCreate(true)}>+ 新建任务</button>
      </div>

      <div className="tabs">
        <button className={`tab ${view === 'my_tasks' ? 'active' : ''}`} onClick={() => setView('my_tasks')}>
          📌 我的待办
        </button>
        <button className={`tab ${view === 'created_by_me' ? 'active' : ''}`} onClick={() => setView('created_by_me')}>
          📤 我创建的
        </button>
      </div>

      {loading ? <Loading /> : tasks.length === 0 ? (
        <EmptyState
          icon="📌"
          title={view === 'my_tasks' ? '暂无待办任务' : '暂无创建的任务'}
          description={view === 'my_tasks' ? '当有人指派任务给您时，会出现在这里' : '点击右上角「新建任务」创建并指派给团队成员'}
        />
      ) : (
        tasks.map(task => (
          <div key={task.task_id} className={`task-card priority-${task.priority}`} style={{ cursor:'pointer' }}
            onClick={() => openDetail(task)}>
            <div className="task-card-header">
              <span className="task-card-title">{task.title}</span>
              <span className={`badge badge-${
                task.status === 'completed' ? 'green' : task.status === 'rejected' ? 'red' : task.status === 'pending' ? 'yellow' : 'blue'
              }`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>
            </div>
            <div className="task-card-meta">
              <span>优先级: {PRIORITY_LABELS[task.priority] || task.priority}</span>
              {task.assigned_to_name && <span>👤 负责人: {task.assigned_to_name}</span>}
              {task.created_by_name && <span>📤 发起人: {task.created_by_name}</span>}
              {task.deadline && <span>⏰ 截止: {new Date(task.deadline).toLocaleDateString('zh-CN')}</span>}
            </div>
            {task.description && <p style={{ fontSize:'.85rem', color:'var(--text-secondary)', marginBottom:'.5rem' }}>{task.description}</p>}

            {view === 'my_tasks' && task.status === 'pending' && (
              <div className="task-card-actions">
                <button className="btn btn-sm btn-accent" onClick={e => { e.stopPropagation(); handleAction(task.task_id, 'accept'); }}>接受</button>
                <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); promptAction(task.task_id, 'reject'); }}>拒绝</button>
              </div>
            )}
            {view === 'my_tasks' && (task.status === 'accepted' || task.status === 'in_progress') && (
              <div className="task-card-actions">
                <button className="btn btn-sm btn-accent" onClick={e => { e.stopPropagation(); promptAction(task.task_id, 'complete'); }}>标记完成</button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Confirm Action Dialog (reject / complete with reason) */}
      {actionDialog && (
        <div className="modal-overlay" onClick={() => setActionDialog(null)}>
          <div className="modal-dialog" style={{ maxWidth:450 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {actionDialog.action === 'reject' ? '❌ 拒绝任务' : '✅ 完成任务'}
            </h3>
            <p style={{ fontSize:'.85rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>
              {actionDialog.action === 'reject'
                ? '请填写拒绝原因（可选）：'
                : '请填写完成情况说明（可选）：'}
            </p>
            <div className="form-group">
              <textarea
                className="form-textarea"
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder={actionDialog.action === 'reject' ? '例如：当前工作繁忙，无法承接此任务' : '例如：已完成合同审查，共发现3个风险点，详见审查报告'}
                rows={3}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setActionDialog(null)}>取消</button>
              <button className={`btn ${actionDialog.action === 'reject' ? 'btn-danger' : 'btn-accent'}`}
                onClick={confirmAction}>
                {actionDialog.action === 'reject' ? '确认拒绝' : '确认完成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {detailTask && (
        <div className="modal-overlay" onClick={() => setDetailTask(null)}>
          <div className="modal-dialog" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{detailTask.title}</h3>
            <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              <span className={`badge badge-${
                detailTask.status === 'completed' ? 'green' : detailTask.status === 'rejected' ? 'red' : detailTask.status === 'pending' ? 'yellow' : 'blue'
              }`}>
                {STATUS_LABELS[detailTask.status] || detailTask.status}
              </span>
              <span className="badge badge-gray">优先级: {PRIORITY_LABELS[detailTask.priority]}</span>
              <span style={{ fontSize:'.8rem', color:'var(--text-muted)' }}>{detailTask.task_type}</span>
            </div>

            <div style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', gap:'2rem', marginBottom:'.5rem', fontSize:'.85rem' }}>
                <div><strong>👤 负责人:</strong> {detailTask.assigned_to_name || detailTask.assigned_to}</div>
                <div><strong>📤 发起人:</strong> {detailTask.created_by_name || detailTask.created_by}</div>
              </div>
              {detailTask.deadline && <div style={{ fontSize:'.85rem' }}><strong>⏰ 截止:</strong> {new Date(detailTask.deadline).toLocaleDateString('zh-CN')}</div>}
              <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:'.5rem' }}>
                创建: {new Date(detailTask.created_at).toLocaleString('zh-CN')}
                {detailTask.accepted_at && <> | 接受: {new Date(detailTask.accepted_at).toLocaleString('zh-CN')}</>}
                {detailTask.completed_at && <> | 完成: {new Date(detailTask.completed_at).toLocaleString('zh-CN')}</>}
              </div>
            </div>

            {detailTask.description && (
              <div style={{ background:'var(--bg)', padding:'1rem', borderRadius:'var(--radius-sm)', marginBottom:'1rem' }}>
                <strong>描述:</strong>
                <p style={{ marginTop:'.25rem', lineHeight:1.7, color:'var(--text-secondary)' }}>{detailTask.description}</p>
              </div>
            )}

            {detailTask.result_summary && (
              <div style={{ background:'#f0fdf4', padding:'1rem', borderRadius:'var(--radius-sm)', marginBottom:'1rem', border:'1px solid #86efac' }}>
                <strong>✅ 结果:</strong>
                <p style={{ marginTop:'.25rem', lineHeight:1.7 }}>{detailTask.result_summary}</p>
              </div>
            )}

            {detailTask.notes && (
              <div style={{ background:'#fef2f2', padding:'1rem', borderRadius:'var(--radius-sm)', marginBottom:'1rem' }}>
                <strong>备注:</strong>
                <p style={{ marginTop:'.25rem' }}>{detailTask.notes}</p>
              </div>
            )}

            {/* Action buttons */}
            {view === 'my_tasks' && detailTask.status === 'pending' && (
              <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
                <button className="btn btn-accent" onClick={() => handleAction(detailTask.task_id, 'accept')}>✅ 接受任务</button>
                <button className="btn btn-outline" onClick={() => promptAction(detailTask.task_id, 'reject')}>❌ 拒绝任务</button>
              </div>
            )}
            {view === 'my_tasks' && (detailTask.status === 'accepted' || detailTask.status === 'in_progress') && (
              <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
                <button className="btn btn-accent" onClick={() => promptAction(detailTask.task_id, 'complete')}>✅ 标记完成</button>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDetailTask(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Dialog */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-dialog" style={{ maxWidth:550 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">新建任务</h3>
            <div className="form-group">
              <label className="form-label">任务标题 *</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="输入任务标题" maxLength={200} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">任务类型</label>
                <select className="form-select" value={taskType} onChange={e => setTaskType(e.target.value)}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">优先级</label>
                <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">低</option><option value="normal">普通</option>
                  <option value="urgent">紧急</option><option value="critical">严重</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">指派给 *</label>
              <select className="form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">-- 选择负责人 --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({ROLE_LABELS[u.role] || u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">描述</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="任务详情说明..." rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-accent" onClick={handleCreate} disabled={creating}>
                {creating ? '创建中...' : '创建任务'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员', legal: '法务人员', business: '业务人员', auditor: '审计员',
};
