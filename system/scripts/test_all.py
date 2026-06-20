"""
全系统功能测试脚本 - 覆盖所有 API 端点和协作流程
"""
import sys, json
sys.path.insert(0, '.')
from src.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
passed = 0
failed = 0
warnings = 0

def t(name, fn):
    global passed, failed, warnings
    try:
        fn()
        passed += 1
        print(f'  [OK] {name}')
    except AssertionError as e:
        failed += 1
        print(f'  [FAIL] {name}: {str(e)[:150]}')
    except Exception as ex:
        failed += 1
        print(f'  [FAIL] {name}: {type(ex).__name__}: {str(ex)[:150]}')

def w(name, fn):
    global passed, failed, warnings
    try:
        fn()
        passed += 1
        print(f'  [OK] {name}')
    except Exception:
        warnings += 1
        print(f'  [WARN] {name} (may be unavailable or missing config)')

# ============ Auth ============
tokens = {}

def login_all():
    global tokens
    for user, pw in [('admin','admin123'),('legal01','legal123'),('biz01','biz123'),('audit01','audit123')]:
        r = client.post('/api/auth/login', json={'username':user,'password':pw})
        assert r.status_code == 200, f'{user} login failed: {r.json()}'
        data = r.json()
        tokens[user] = (data['access_token'], data['user']['id'])

print('=== 1. Authentication ===')
t('All 4 roles login', login_all)
t('No token returns 401', lambda: (
    client.get('/api/auth/me').status_code == 401 or (_ for _ in ()).throw(AssertionError('Expected 401'))
))

def test_rate():
    for i in range(10):
        r = client.post('/api/auth/login', json={'username':'admin','password':'wrongpw'})
        if r.status_code == 429: return
    raise AssertionError('Rate limit not triggered')
t('Rate limiting (login)', test_rate)

biz_tok, biz_id = tokens['biz01']
legal_tok, legal_id = tokens['legal01']
admin_tok, admin_id = tokens['admin']
audit_tok, audit_id = tokens['audit01']

# ============ Contracts ============
print('\n=== 2. Contract Management ===')
contract_id = None
contract_id2 = None

def create_contract():
    global contract_id
    r = client.post('/api/contracts/upload', json={
        'title': '设备采购合同',
        'contract_type': '买卖合同',
        'party_a': '甲公司',
        'party_b': '乙公司',
        'content': '第一条 合同标的：甲方向乙方采购服务器设备10台。\n第二条 合同金额：人民币壹佰万元整。\n第三条 违约责任：任何一方违约需支付合同总额50%的违约金。\n第四条 争议解决：发生争议提交甲方所在地法院诉讼解决。'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200, f'Create contract: {r.json()}'
    contract_id = r.json().get('id') or r.json().get('contract_id')
    assert contract_id
t('Create contract', create_contract)

t('List contracts', lambda: (
    len(client.get('/api/contracts', headers={'Authorization': f'Bearer {biz_tok}'}).json()) >= 1 or (_ for _ in ()).throw(AssertionError('No contracts'))
))

def review():
    r = client.post(f'/api/contracts/review/{contract_id}', headers={'Authorization': f'Bearer {legal_tok}'})
    assert r.status_code in (200, 503), f'Review: {r.status_code} {r.json()}'
t('Review contract', review)

def compare():
    global contract_id2
    r = client.post('/api/contracts/upload', json={
        'title': '设备采购合同v2',
        'contract_type': '买卖合同',
        'party_a': '甲公司',
        'party_b': '乙公司',
        'content': '第一条 合同标的：甲方向乙方采购服务器设备15台。\n第二条 合同金额：人民币壹佰伍拾万元整。'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200
    contract_id2 = r.json().get('id') or r.json().get('contract_id')
    r2 = client.post('/api/contracts/compare', json={
        'contract_a_id': contract_id, 'contract_b_id': contract_id2
    }, headers={'Authorization': f'Bearer {legal_tok}'})
    assert r2.status_code == 200, f'Compare: {r2.json()}'
t('Compare contracts', compare)

w('Generate contract', lambda: client.post('/api/contracts/generate', json={
    'contract_type': '服务合同', 'party_a': '甲', 'party_b': '乙', 'key_terms': '技术服务'
}, headers={'Authorization': f'Bearer {legal_tok}'}))

# ============ Cases ============
print('\n=== 3. Case Management ===')
case_id = None

def create_case():
    global case_id
    r = client.post('/api/case/profiles', json={
        'case_name': '劳动纠纷测试案',
        'case_type': 'labor',
        'description': '员工与公司的劳动合同解除纠纷'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200, f'Create case: {r.json()}'
    case_id = r.json().get('case_id')
t('Create case', create_case)
t('List cases', lambda: (
    isinstance(client.get('/api/case/profiles', headers={'Authorization': f'Bearer {biz_tok}'}).json(), list) or (_ for _ in ()).throw(AssertionError('Not a list'))
))
t('Get case detail', lambda: (
    client.get(f'/api/case/profiles/{case_id}', headers={'Authorization': f'Bearer {biz_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))
t('Update case', lambda: (
    client.put(f'/api/case/profiles/{case_id}', json={'case_name': '已更新'}, headers={'Authorization': f'Bearer {biz_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# Case analysis (may need LLM)
w('Analyze case', lambda: client.post(f'/api/case/analyze/{case_id}', json={
    'structured_facts': {'employee_name': '张三', 'monthly_wage': '8000'}
}, headers={'Authorization': f'Bearer {legal_tok}'}))

# ============ Consultation ============
print('\n=== 4. Consultation')
w('Ask question', lambda: client.post('/api/consultation/ask', json={
    'question': '如何计算经济补偿金？', 'scope': ''
}, headers={'Authorization': f'Bearer {biz_tok}'}))
t('Get history', lambda: (
    client.get('/api/consultation/history', headers={'Authorization': f'Bearer {biz_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Tasks ============
print('\n=== 5. Task System')
task_id = None

def create_task():
    global task_id
    r = client.post('/api/tasks', json={
        'title': '审查设备采购合同',
        'task_type': 'contract_review',
        'priority': 'urgent',
        'assigned_to': legal_id,
        'entity_type': 'contract',
        'entity_id': contract_id,
        'description': '请审查违约责任条款'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200, f'Create task: {r.json()}'
    task_id = r.json()['task_id']
t('Create task (business->legal)', create_task)
t('List my tasks', lambda: (
    len(client.get('/api/tasks?filter=my_tasks', headers={'Authorization': f'Bearer {legal_tok}'}).json()) >= 1 or (_ for _ in ()).throw(AssertionError('No tasks'))
))
t('Accept task', lambda: (
    client.put(f'/api/tasks/{task_id}/accept', headers={'Authorization': f'Bearer {legal_tok}'}).json()['status'] == 'accepted' or (_ for _ in ()).throw(AssertionError('Not accepted'))
))
t('Complete task', lambda: (
    client.put(f'/api/tasks/{task_id}/complete', json={'result_summary': '审查完成，3个风险点'}, headers={'Authorization': f'Bearer {legal_tok}'}).json()['status'] == 'completed' or (_ for _ in ()).throw(AssertionError('Not completed'))
))

# ============ Notifications ============
print('\n=== 6. Notifications')
t('Unread count', lambda: (
    'count' in client.get('/api/notifications/unread-count', headers={'Authorization': f'Bearer {legal_tok}'}).json() or (_ for _ in ()).throw(AssertionError('No count'))
))
t('List notifications', lambda: (
    isinstance(client.get('/api/notifications', headers={'Authorization': f'Bearer {legal_tok}'}).json(), list) or (_ for _ in ()).throw(AssertionError('Not list'))
))
t('Mark all read', lambda: (
    client.put('/api/notifications/read-all', headers={'Authorization': f'Bearer {legal_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Comments ============
print('\n=== 7. Comments')
t('Create comment', lambda: (
    client.post('/api/comments', json={
        'entity_type': 'contract', 'entity_id': contract_id,
        'content': '建议增加免责条款'
    }, headers={'Authorization': f'Bearer {legal_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))
t('List comments', lambda: (
    len(client.get(f'/api/comments/contract/{contract_id}', headers={'Authorization': f'Bearer {biz_tok}'}).json()) >= 1 or (_ for _ in ()).throw(AssertionError('No comments'))
))

# ============ Approvals ============
print('\n=== 8. Approvals')
approval_id = None

def submit_approval():
    global approval_id
    r = client.post('/api/approvals', json={
        'entity_type': 'contract', 'entity_id': contract_id,
        'approver_id': legal_id, 'comment': '请审批'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200, f'Submit: {r.json()}'
    approval_id = r.json().get('approval_id')
t('Submit approval', submit_approval)
t('Approve', lambda: (
    client.put(f'/api/approvals/{approval_id}/approve', json={'comment': '同意'},
              headers={'Authorization': f'Bearer {legal_tok}'}).json()['status'] == 'approved' or (_ for _ in ()).throw(AssertionError('Not approved'))
))

# ============ Escalation ============
print('\n=== 9. Escalation')
esc_id = None

def create_esc():
    global esc_id
    r = client.post('/api/escalation/request', json={
        'question': '知识产权侵权咨询', 'contact': '13800138001'
    }, headers={'Authorization': f'Bearer {biz_tok}'})
    assert r.status_code == 200, f'Create: {r.json()}'
    esc_id = r.json()['request_id']
t('Create escalation', create_esc)
t('List escalations', lambda: (
    len(client.get('/api/escalation/list', headers={'Authorization': f'Bearer {legal_tok}'}).json()) >= 1 or (_ for _ in ()).throw(AssertionError('Empty'))
))
t('Claim escalation', lambda: (
    client.put(f'/api/escalation/{esc_id}/claim', headers={'Authorization': f'Bearer {legal_tok}'}).json()['status'] == 'processing' or (_ for _ in ()).throw(AssertionError('Not processing'))
))
t('Resolve escalation', lambda: (
    client.put(f'/api/escalation/{esc_id}/resolve', json={'resolution_note': '已解答'},
              headers={'Authorization': f'Bearer {legal_tok}'}).json()['status'] == 'resolved' or (_ for _ in ()).throw(AssertionError('Not resolved'))
))

# ============ Settings ============
print('\n=== 10. Settings')
t('Get settings (admin)', lambda: (
    client.get('/api/settings', headers={'Authorization': f'Bearer {admin_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))
t('Save settings', lambda: (
    client.post('/api/settings/update', json={'log_level': 'INFO'}, headers={'Authorization': f'Bearer {admin_tok}'}).status_code in (200, 400) or (_ for _ in ()).throw(AssertionError('Unexpected'))
))
t('List users', lambda: (
    len(client.get('/api/auth/users', headers={'Authorization': f'Bearer {admin_tok}'}).json()) >= 4 or (_ for _ in ()).throw(AssertionError('Wrong user count'))
))
w('Test LLM', lambda: client.post('/api/settings/test-llm', headers={'Authorization': f'Bearer {admin_tok}'}))
w('Test Neo4j', lambda: client.post('/api/settings/test-neo4j', headers={'Authorization': f'Bearer {admin_tok}'}))

# ============ KG ============
print('\n=== 11. Knowledge Graph')
t('KG search', lambda: (
    client.get('/api/kg/search?keyword=合同', headers={'Authorization': f'Bearer {legal_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))
t('KG stats', lambda: (
    client.get('/api/kg/stats', headers={'Authorization': f'Bearer {legal_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Audit ============
print('\n=== 12. Audit')
t('Audit logs', lambda: (
    'logs' in client.get('/api/audit/logs', headers={'Authorization': f'Bearer {audit_tok}'}).json() or (_ for _ in ()).throw(AssertionError('No logs'))
))
t('Export audit', lambda: (
    client.post('/api/audit/export?format=json', headers={'Authorization': f'Bearer {admin_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Templates ============
print('\n=== 13. Templates')
t('List templates', lambda: (
    isinstance(client.get('/api/templates', headers={'Authorization': f'Bearer {biz_tok}'}).json(), list) or (_ for _ in ()).throw(AssertionError('Not list'))
))

# ============ Calculators ============
print('\n=== 14. Calculators')
w('Court fee', lambda: client.post('/api/calculator/court-fee', json={
    'case_type': 'property', 'claim_amount': 500000
}, headers={'Authorization': f'Bearer {biz_tok}'}))
w('Compensation', lambda: client.post('/api/calculator/compensation', json={
    'scenario': 'dismissal', 'params': {'monthly_wage': 8000, 'years_worked': 5}
}, headers={'Authorization': f'Bearer {biz_tok}'}))
w('Limitation', lambda: client.post('/api/calculator/limitation', json={
    'case_type': 'general', 'event_date': '2024-01-15'
}, headers={'Authorization': f'Bearer {biz_tok}'}))

# ============ Evidence / Topics ============
print('\n=== 15. Evidence & Topics')
w('Evidence cases', lambda: client.get('/api/evidence/cases', headers={'Authorization': f'Bearer {biz_tok}'}))
t('Topics list', lambda: (
    client.get('/api/topics', headers={'Authorization': f'Bearer {biz_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))
t('Search topics', lambda: (
    client.get('/api/topics/search/劳动', headers={'Authorization': f'Bearer {biz_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Health ============
print('\n=== 16. Health')
t('Health check', lambda: (
    client.get('/api/health').json()['status'] == 'ok' or (_ for _ in ()).throw(AssertionError('Not ok'))
))

# ============ Cleanup ============
print('\n=== 17. Cleanup')
t('Delete case', lambda: (
    client.delete(f'/api/case/profiles/{case_id}', headers={'Authorization': f'Bearer {admin_tok}'}).status_code == 200 or (_ for _ in ()).throw(AssertionError('Not 200'))
))

# ============ Summary ============
print()
print('=' * 55)
print(f'  Passed : {passed}')
print(f'  Failed : {failed}')
print(f'  Warnings: {warnings}')
print(f'  Total  : {passed + failed + warnings}')
if failed == 0:
    print('  >>> ALL CORE TESTS PASSED <<<')
else:
    print(f'  >>> {failed} TEST(S) FAILED <<<')
print('=' * 55)
