import { useState, useRef, useEffect } from 'react';
import { consultationApi } from '../../../api/consultation';
import { useToast } from '../../../contexts/ToastContext';
import { renderMarkdown } from '../../../utils/markdown';
import ConfirmDialog from '../../common/ConfirmDialog';

const QUICK_QUESTIONS = [
  '劳动合同解除的赔偿标准是什么？',
  '合同中违约金过高怎么办？',
  '借款纠纷的诉讼时效是多久？',
  '发生交通事故后如何索赔？',
];

const SCOPE_OPTIONS = [
  { value: '', label: '全部来源' },
  { value: 'laws', label: '法规库' },
  { value: 'cases', label: '判例库' },
  { value: 'contracts', label: '合同库' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  law_basis?: { law: string; article: string; content: string }[];
  search_results?: { source: string; article: string; content: string; relevance: number }[];
  disclaimer?: string;
  timestamp: string;
}

const HISTORY_KEY = 'legal_chat_v3';

export default function Consultation() {
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [scope, setScope] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res: any = await consultationApi.ask(q, scope || undefined);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer || res.content || '',
        law_basis: res.law_basis,
        search_results: res.search_results,
        disclaimer: res.disclaimer,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err.message || '请求失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    setShowConfirm(false);
    showToast('对话历史已清除', 'info');
  }

  return (
    <div className="page-section">
      <h2 className="page-title">智能咨询</h2>
      <p className="page-desc">7x24 小时 AI 法律咨询，基于法规库和判例库提供专业回答</p>

      {/* Chat Area */}
      <div className="card" style={{ marginBottom:'1rem', minHeight:'300px', maxHeight:'60vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>💬</div>
              <h3 style={{ marginBottom:'.5rem' }}>智能法律咨询</h3>
              <p style={{ fontSize:'.88rem', maxWidth:420, margin:'0 auto 1.5rem', lineHeight:1.7 }}>
                输入您的法律问题，AI 将基于法律法规和判例数据库为您提供专业解答。
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem', maxWidth:360, margin:'0 auto' }}>
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} className="chat-hint" onClick={() => setInput(q)}>{q}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`chat-msg ${m.role}`}>
                <div className="chat-msg-avatar">{m.role === 'user' ? '👤' : '⚖️'}</div>
                <div className="chat-msg-body">
                  <div className="chat-msg-name">{m.role === 'user' ? '您' : 'AI 法务助手'}</div>
                  <div className="chat-msg-content">
                    {m.role === 'user' ? (
                      <span className="chat-user-text">{m.content}</span>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    )}
                    {m.law_basis && m.law_basis.length > 0 && (
                      <details className="chat-details">
                        <summary>📚 法律依据 ({m.law_basis.length} 条)</summary>
                        <div className="chat-details-body">
                          {m.law_basis.map((lb, i) => (
                            <div key={i} style={{ marginBottom:'.3rem' }}>
                              <strong>{lb.law} {lb.article}</strong>: {lb.content}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {m.search_results && m.search_results.length > 0 && (
                      <details className="chat-details">
                        <summary>🔍 检索结果 ({m.search_results.length} 条)</summary>
                        <div className="chat-details-body">
                          {m.search_results.map((r, i) => (
                            <div key={i} style={{ marginBottom:'.3rem' }}>
                              <span style={{ fontWeight:600 }}>[{r.source}]</span> {r.article}: {r.content}
                              <span style={{ color:'var(--text-muted)', marginLeft:'.5rem' }}>
                                相关度: {(r.relevance * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {m.disclaimer && <div className="chat-disclaimer">{m.disclaimer}</div>}
                  </div>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="chat-msg assistant">
              <div className="chat-msg-avatar">⚖️</div>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
                <span style={{ marginLeft:'.5rem', fontSize:'.8rem', color:'var(--text-secondary)' }}>AI 思考中...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="card" style={{ display:'flex', gap:'.75rem', alignItems:'center', padding:'.75rem 1rem' }}>
        <select className="form-select" style={{ width:'120px' }} value={scope} onChange={e => setScope(e.target.value)}>
          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          className="form-input"
          style={{ flex:1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入您的问题，按 Enter 发送..."
          disabled={loading}
        />
        <button className="btn btn-accent" onClick={send} disabled={loading || !input.trim()}>
          发送
        </button>
        {messages.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowConfirm(true)} title="清除对话">🗑</button>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="清除对话"
        message="确定要清除所有对话历史吗？此操作不可撤销。"
        onConfirm={clearHistory}
        onCancel={() => setShowConfirm(false)}
        confirmText="清除"
        danger
      />
    </div>
  );
}
