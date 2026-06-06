"""
法规专题库服务
"""
import json
from pathlib import Path
from src.config import settings


class TopicService:

    def __init__(self):
        self._store_path = Path(settings.BASE_DIR) / "data" / "topic_libraries.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_defaults()

    def _ensure_defaults(self):
        if self._store_path.exists():
            return
        topics = [
            {
                "topic_id": "labor_dispute",
                "title": "劳动争议专题",
                "description": "劳动合同签订、履行、解除、终止，经济补偿金、赔偿金、工伤认定等",
                "icon": "👷",
                "laws": [
                    {"name": "中华人民共和国劳动合同法", "key_articles": ["第10条（书面合同）", "第47条（经济补偿）", "第82条（未签合同二倍工资）", "第87条（违法解除赔偿）"]},
                    {"name": "中华人民共和国劳动争议调解仲裁法", "key_articles": ["第27条（仲裁时效）", "第28条（申请书内容）"]},
                    {"name": "工伤保险条例", "key_articles": ["第14条（认定工伤的情形）", "第17条（申请时限）"]},
                ],
                "faq": [
                    {"q": "公司没签劳动合同怎么办？", "a": "根据《劳动合同法》第82条，用人单位自用工之日起超过一个月不满一年未签订书面劳动合同的，应向劳动者每月支付二倍工资。建议收集工资记录、工作证等能证明劳动关系的材料，向劳动监察部门投诉或申请劳动仲裁。"},
                    {"q": "被公司辞退能拿多少补偿？", "a": "合法解除：按工作年限每满一年支付一个月工资（N）；违法解除：按经济补偿的二倍支付（2N）；未提前30天通知的另加1个月代通知金（+1）。月工资超过当地社平工资3倍的按3倍计算。"},
                    {"q": "辞职后多久能拿到工资？", "a": "依据《工资支付暂行规定》第9条，劳动关系终止时应一次性结清工资。如用人单位拖欠，可向劳动监察部门投诉或申请劳动仲裁。"},
                ],
            },
            {
                "topic_id": "private_lending",
                "title": "民间借贷专题",
                "description": "个人借款纠纷、利息计算、借条规范、诉讼时效等",
                "icon": "💰",
                "laws": [
                    {"name": "中华人民共和国民法典", "key_articles": ["第667条（借款合同定义）", "第675条（还款期限）", "第676条（逾期利息）", "第680条（禁止高利贷）"]},
                    {"name": "最高人民法院关于审理民间借贷案件适用法律若干问题的规定", "key_articles": ["第25条（利率上限LPR四倍）", "第26条（借条效力）", "第28条（逾期利率）"]},
                ],
                "faq": [
                    {"q": "朋友借钱不还怎么办？", "a": "首先保留借条和转账记录等证据，尝试与对方协商。协商不成的可向法院起诉。注意诉讼时效为3年，从约定的还款日或您第一次催收时起算。建议每次催收保留记录以中断时效。"},
                    {"q": "民间借贷利率多少合法？", "a": "根据最高人民法院规定，民间借贷利率上限为合同成立时一年期贷款市场报价利率（LPR）的4倍。超出部分法院不予支持。目前LPR约为3.1%，4倍约为12.4%。"},
                    {"q": "没有借条能起诉吗？", "a": "可以，但需要其他证据证明借贷关系存在，如银行转账记录、微信/支付宝转账记录、聊天记录、录音录像等。大额借款建议尽量补写借条。"},
                ],
            },
            {
                "topic_id": "consumer_rights",
                "title": "消费维权专题",
                "description": "消费者权益保护、退一赔三、食品安全十倍赔偿等",
                "icon": "🛒",
                "laws": [
                    {"name": "中华人民共和国消费者权益保护法", "key_articles": ["第55条（三倍赔偿）", "第23条（经营者保证义务）", "第25条（七日无理由退货）"]},
                    {"name": "中华人民共和国食品安全法", "key_articles": ["第148条（十倍赔偿）", "第34条（禁止生产经营的食品）"]},
                    {"name": "中华人民共和国民法典", "key_articles": ["第1203条（产品责任）"]},
                ],
                "faq": [
                    {"q": "买到假货怎么维权？", "a": "保留购物凭证和商品实物，向商家要求退货退款并三倍赔偿（不足500元按500元）。商家拒绝的可向12315投诉或向法院起诉。"},
                    {"q": "吃到问题食品能索赔多少？", "a": "根据《食品安全法》第148条，可要求支付价款十倍或损失三倍的赔偿金，不足1000元的按1000元计算。需保留问题食品样本和消费凭证。"},
                    {"q": "网购商品不满意能退吗？", "a": "根据《消费者权益保护法》第25条，网购商品适用七日无理由退货，但定作商品、鲜活易腐、在线下载数字化商品等特殊商品除外。退货商品应完好，运费由消费者承担（另有约定除外）。"},
                ],
            },
            {
                "topic_id": "marriage_family",
                "title": "婚姻家事专题",
                "description": "离婚、财产分割、子女抚养、遗产继承等",
                "icon": "👨‍👩‍👧",
                "laws": [
                    {"name": "中华人民共和国民法典·婚姻家庭编", "key_articles": ["第1079条（离婚条件）", "第1084条（子女抚养）", "第1087条（财产分割）", "第1062条（共同财产）"]},
                    {"name": "中华人民共和国民法典·继承编", "key_articles": ["第1127条（法定继承顺序）", "第1133条（遗嘱继承）"]},
                ],
                "faq": [
                    {"q": "离婚财产怎么分？", "a": "婚前财产归各自所有；婚后取得的财产为夫妻共同财产，一般均等分割。有过错方（家暴、重婚等）可能少分或不分。双方可协商，协商不成的由法院判决。"},
                    {"q": "孩子抚养权归谁？", "a": "2周岁以下一般随母亲；2-8周岁按最有利于子女原则确定；8周岁以上应尊重子女意愿。法院综合考虑经济能力、居住环境、子女意愿等因素。"},
                    {"q": "配偶去世后遗产怎么分？", "a": "有遗嘱的按遗嘱处理；无遗嘱的按法定继承：第一顺序为配偶、子女、父母，原则上均等分配。需先将夫妻共同财产的一半分出为配偶所有，其余为遗产。"},
                ],
            },
            {
                "topic_id": "traffic_accident",
                "title": "交通事故专题",
                "description": "交通肇事、赔偿标准、保险理赔、责任认定等",
                "icon": "🚗",
                "laws": [
                    {"name": "中华人民共和国道路交通安全法", "key_articles": ["第73条（事故处理）", "第76条（赔偿责任）"]},
                    {"name": "中华人民共和国民法典", "key_articles": ["第1208条（机动车交通事故责任）", "第1179条（人身损害赔偿范围）"]},
                ],
                "faq": [
                    {"q": "发生交通事故后该做什么？", "a": "立即停车、保护现场、救助伤员、报警（122）并通知保险公司。拍照录像固定证据，互换驾驶证和保险信息。不要私了重伤或争议事故。"},
                    {"q": "交通事故赔偿包括哪些？", "a": "医疗费、误工费、护理费、交通费、住院伙食补助费、营养费，构成伤残的还包括残疾赔偿金和精神损害抚慰金。具体数额需根据实际损失和相关标准计算。"},
                ],
            },
            {
                "topic_id": "contract_dispute",
                "title": "合同纠纷专题",
                "description": "合同签订、履行、违约、解除、诉讼时效等",
                "icon": "📄",
                "laws": [
                    {"name": "中华人民共和国民法典·合同编", "key_articles": ["第577条（违约责任）", "第584条（损失赔偿范围）", "第585条（违约金）", "第563条（合同解除）"]},
                ],
                "faq": [
                    {"q": "合同违约金多少合理？", "a": "根据《民法典》第585条，违约金过高的可请求法院适当减少。司法实践中一般不超过实际损失的30%。具体由法院根据违约程度、实际损失等因素裁量。"},
                    {"q": "什么情况下可以解除合同？", "a": "《民法典》第563条规定：不可抗力导致合同目的不能实现、对方明确表示不履行、经催告后仍不履行、迟延履行导致合同目的不能实现等情形。解除合同应通知对方。"},
                ],
            },
        ]
        self._store_path.write_text(json.dumps(topics, ensure_ascii=False, indent=2), encoding="utf-8")

    def list_topics(self) -> list[dict]:
        data = json.loads(self._store_path.read_text(encoding="utf-8"))
        return [{"topic_id": t["topic_id"], "title": t["title"],
                 "description": t.get("description", ""), "icon": t.get("icon", "")} for t in data]

    def get_topic(self, topic_id: str) -> dict | None:
        data = json.loads(self._store_path.read_text(encoding="utf-8"))
        for t in data:
            if t["topic_id"] == topic_id:
                return t
        return None

    def search(self, keyword: str) -> list[dict]:
        data = json.loads(self._store_path.read_text(encoding="utf-8"))
        results = []
        kw = keyword.lower()
        for t in data:
            score = 0
            if kw in t["title"]: score += 3
            if kw in t.get("description", ""): score += 2
            for faq in t.get("faq", []):
                if kw in faq.get("q", "") or kw in faq.get("a", ""):
                    score += 1
                    break
            if score > 0:
                results.append({"topic_id": t["topic_id"], "title": t["title"],
                                "description": t.get("description", ""), "icon": t.get("icon", ""), "score": score})
        results.sort(key=lambda x: x["score"], reverse=True)
        return results


topic_service = TopicService()
