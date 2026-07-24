# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 项目概述

**PK Repository** — 个人知识库管理系统，课程大作业项目。核心功能：多格式文档导入 → AI 自动构建知识图谱 → 基于 RAG 的智能对话助手。

- **总工期**：2026.07.19 — 2026.08.20（32 天）
- **团队规模**：3 人
- **关键文档**：`Requirements.md`（需求）、`技术栈选择.md`（技术选型分析）、`项目分工与阶段计划.md`（分工与阶段）

---

## 最终技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 前端框架 | React 18 + Vite + TypeScript | SPA 纯静态部署 |
| UI 库 | Ant Design 5 | 后台管理类组件丰富 |
| 状态管理 | Zustand | 轻量级 |
| 图谱可视化 | **ECharts 5** | 力导向图快速出图；后期可升级 D3.js |
| 后端框架 | FastAPI + SQLAlchemy + Pydantic | 自动 Swagger 文档 |
| 关系数据库 | SQLite | 单用户，零配置 |
| 向量数据库 | ChromaDB | 支持元数据过滤 `where kb_id` |
| LLM | DeepSeek API（主力）→ Qwen 本地（答辩加分） | 混合架构 |
| Embedding | BGE-M3 本地（FlagEmbedding） | 备选 DeepSeek Embedding API |
| RAG 编排 | **LangChain** | 课程模块四直接讲 LangChain，理论-实践对应 |
| 文档解析 | PyMuPDF / python-pptx / python-docx / chardet | 逐格式专用库 |

---

## 团队分工与代号映射

| 日志文件夹 | 项目代号 | 角色 | 核心职责 |
|---|---|---|---|
| `projectInfo/YAL/` | **A** | 后端/AI 核心 | FastAPI、ChromaDB、LLM API、Prompt 工程、SSE 流式 |
| `projectInfo/XZY/` | **B** | 前端/可视化 | React、Ant Design、ECharts 图谱、文档阅读器、AI 对话 UI |
| `projectInfo/LSC/` | **C** | 数据工程/联调 | 文档解析、文本分块、Mock 数据、联调测试、部署文档 |

---

## 阶段计划与里程碑

```
Phase 0 (7/19-7/20)：API 契约定稿 + 脚手架        → M0: Swagger 可访问，JSON 格式三人确认
Phase 1 (7/21-7/27)：数据层打通                    → M1: 脚本级检索跑通（ingest.py → search.py）
Phase 2 (7/28-8/03)：RAG 核心链路                  → M2: 网页上传文档 → 对话提问 → SSE 流式带来源回答
Phase 3 (8/04-8/10)：知识图谱可视化                 → M3: 图谱展示 30-80 节点，可交互，可跳转文档
Phase 4 (8/11-8/17)：联调美化 + Qwen 部署 + 报告    → M4: 功能冻结，Qwen 可演示，报告初稿完成
Phase 5 (8/18-8/19)：收尾交付                       → M5: 报告终稿 + PPT + 演示视频
```

**硬性降级决策点**：
- **8/5**：ECharts 力导向图节点颜色/大小/高亮任一项未完成 → 简化交互，保证基本展示
- **8/3**：PPT/DOCX 解析可读性 < 70% → 只提取纯文本
- **8/6**：LLM 概念提取 < 20 个或重复率 > 50% → 收紧 Prompt + 降低去重阈值
- **8/10**：BGE-M3 本地部署失败 → 切 DeepSeek Embedding API
- **8/12**：Qwen 本地部署失败 → 保留接口预留，答辩说明架构已适配

---

## API 契约（Phase 0 定稿 v2 — 2026-07-20）

> **变更摘要**：
> - tags 从逗号分隔字符串改为 `list[str]` JSON 数组
> - 对话端点从 `/api/kbs/{kb_id}/chat` 迁移到 `/api/chat`，kb_id 作为请求体可选字段
> - 端点从 8 个扩展到 23 个
> - 新增更新/详情/重命名/导出/全文搜索/对话历史/分析管理/向量重建端点

### 知识库管理（7 个端点）

```yaml
GET    /api/kbs              → {kbs: [{id, name, description, tags: [str], doc_count, created_at}]}
POST   /api/kbs              → 入参 {name: str, description?: str, tags?: [str]} → 出参 {id, ...}
PUT    /api/kbs/{kb_id}      → 入参 {name?, description?, tags?} → 出参 {id, ...} (Phase 0 完整实现)
DELETE /api/kbs/{kb_id}      → {success: bool} (级联删除)
GET    /api/kbs/{kb_id}/export      → {kb, concepts: [], relations: [], documents: []} (Phase 3 占位)
GET    /api/kbs/{kb_id}/search?q=&page=1&page_size=20 → {results: [{doc_id, doc_name, page_num, snippet}]} (Phase 1 占位)
POST   /api/kbs/{kb_id}/reindex    → {kb_id, total_chunks, status} (Phase 2 占位)
```

### 文档管理（7 个端点）

```yaml
POST   /api/kbs/{kb_id}/docs/upload               → FormData(file) → {doc_id, filename, type, pages, size, status}
GET    /api/kbs/{kb_id}/docs?status=               → {docs: [{doc_id, filename, type, pages, size, status, created_at}]}
GET    /api/kbs/{kb_id}/docs/{doc_id}              → {doc_id, filename, type, pages, size, status, created_at, concept_refs, chunk_count} (Phase 0 完整实现)
PUT    /api/kbs/{kb_id}/docs/{doc_id}              → 入参 {filename: str} → 出参 同上 (Phase 0 完整实现，重命名)
DELETE /api/kbs/{kb_id}/docs/{doc_id}              → {success: bool} (向量同步删除 — Phase 2 增强)
GET    /api/kbs/{kb_id}/docs/{doc_id}/content?page=1 → {pages: [{page_num, text}], total_pages}
GET    /api/kbs/{kb_id}/docs/{doc_id}/page-image?page=1 → FileResponse(image/png) (Phase 3 占位)
```

### 知识图谱（4 个端点）

```yaml
GET    /api/kbs/{kb_id}/graph                       → {nodes: [{id, name, definition, type, degree, doc_refs}], edges: [{source, target, relation, description}]}
GET    /api/kbs/{kb_id}/concepts/{cid}/positions    → {concept_id, concept_name, positions: [{doc_id, doc_name, page_num, paragraph}]} (Phase 3 占位)
POST   /api/kbs/{kb_id}/analyze                     → 入参 {doc_ids?, incremental} → {kb_id, status} (Phase 3 占位)
GET    /api/kbs/{kb_id}/analyze/status              → {kb_id, status, progress, current_step, error} (Phase 3 占位)
```

- **Node type 枚举**：`基础概念` | `技术方法` | `工具框架` | `应用场景` | `其他`
- **Edge relation 枚举**：`前置依赖` | `概念延伸` | `对比关系` | `包含关系` | `应用关系`

### 对话（4 个端点）

```yaml
POST   /api/chat                           → 入参 {question, context_type: "doc"|"kb"|"global", kb_id?, doc_id?, page?} → SSE text/event-stream (Phase 2 完整实现)
GET    /api/kbs/{kb_id}/chat/history       → {kb_id, messages: [{id, role, content, sources, follow_up_questions, created_at}]} (Phase 2 占位)
GET    /api/chat/history                   → {kb_id: null, messages: [...]} (Phase 2 占位，全局对话)
DELETE /api/kbs/{kb_id}/chat/history       → {success: bool} (Phase 2 占位)
```

**SSE 流式响应格式**（Phase 2 完整实现）：
```
data: {"type":"token",   "content":"卷积"}
data: {"type":"source",  "sources":[{"doc_name":"...","doc_id":"...","page":1,"chunk_text":"...","score":0.9}]}
data: {"type":"done",    "message_id":"msg_xxx", "follow_up_questions":["...?"]}
data: {"type":"error",   "content":"错误描述"}
```

### 检索（1 个端点）

```yaml
POST /api/search  → 入参 {kb_id: str, query: str, top_k?: int=5} → {results: [{chunk_text, doc_name, page, score}]} (Phase 1 完整实现)
```

---

## 项目工作规范

### 一、Todo-list 管理

- 项目启动后生成 Todo-list，格式：**【序号】+【任务内容】+【优先级（高/中/低）】+【预计完成时长】**
- 序号对齐 `项目分工与阶段计划.md` 中的子任务编号（如 `1.1`、`2.4`）
- 严格按序执行，不得跳过或修改。需调整时先记录项目日志并说明原因，经确认后执行
- 每完成一项标注【已完成】及完成时间；未完成任务每日更新进度

### 二、项目日志管理

**存放规则**：
- 日志文件位于 `projectInfo/{YAL|XZY|LSC}/` 下，按成员各自维护
- 文件命名：`MM-DD.md`（如 `7-25.md`），按日期分文件

**编写规则**：
- 格式：**【时间（精确到小时）】+【操作类型】+【具体内容】+【原因/备注】**
- 操作类型：`生成Todo`、`修改任务`、`执行修改`、`思考决策`、`里程碑检查`
- 每条完整操作日志必须包含四项：**执行指令草稿、草稿自检结果、用户确认记录、实际执行内容**
- 小细节可简化，核心操作和决策必须详细记录

**新对话启动规则**：
- 仅复制**最近 3 天日志摘要** + **当前阶段里程碑状态** + **未完成任务清单**，不复制全部日志

### 三、修改/执行任务流程

**完整流程**（涉及功能逻辑、API、数据结构时强制执行）：
1. **生成执行指令草稿**：明确修改目标、具体执行步骤、预期效果
2. **草稿自检**（四项标准）：逻辑完整、与日志历史一致、贴合当前目标、无语病
3. **用户确认**：告知将要修改的文件、具体内容、原因、预期影响范围，等待明确确认
4. **执行操作**
5. **记录日志**：将草稿、检查结果、确认记录、实际执行内容写入日志

**轻量通道**（仅限以下场景，可跳过步骤 2-3，直接执行后补记日志）：
- Typo 修正、格式调整、注释修正
- 不涉及逻辑变更的纯文本修改
- 用户明确说"直接改"的指令

### 四、流程校验

- 每次执行任务前，先读取项目日志确认无信息偏差
- 每完成一次完整操作（草稿→检查→确认→执行→记录），在回复末尾标注：**"已完成标准流程"**
- 若未按流程执行，立即停止，回溯日志修正后再继续

### 五、方案设计信息验证

以下场景必须先联网验证再设计方案：
1. 选择第三方模型/库/框架时，验证其存在性和可用性
2. 涉及 API 调用时，确认接口文档和最新版本
3. 技术方案依赖特定版本时，验证版本兼容性
4. 任何不确定信息，优先联网核实

验证失败时：停止当前方案 → 记录日志 → 搜索至少 2-3 个替代方案 → 对比推荐 → 等待确认。
验证后记录：【验证时间】、【验证内容】、【验证结果】、【信息来源】。

### 六、阶段里程碑检查

每个 Phase 结束时，对照 `项目分工与阶段计划.md` 中的达成标准逐条确认：
- 通过项 / 未通过项 / 风险项
- 未通过项指定责任人和补救截止时间
- 检查结果记录至各成员日志文件

### 七、需求信息校验（执行前准备）

每次接收任务后，先校验已有信息是否足够：
- 足够 → 直接执行
- 不足 → 向用户明确询问缺失信息（仅问必要内容），或开启 WebSearch 联网搜索获取

---

## Mock 数据目录

Mock 数据由 C（LSC）维护在 `mock/` 目录下，供 B（XZY）独立开发使用：
- `mock/kbs.json` — 知识库列表
- `mock/kb_{id}_docs.json` — 文档列表
- `mock/kb_{id}_graph.json` — 图谱 nodes + edges
- `mock/chat_messages.json` — 对话消息

---

## 开发环境

```bash
# 后端启动
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 前端启动
cd frontend
npm install
npm run dev

# 文档入库脚本（Phase 1 验证用）
python scripts/ingest.py <file_path> --kb-id <kb_id>

# 检索测试脚本（Phase 1 验证用）
python scripts/search.py "<query>" --kb-id <kb_id>
```
