# PKR — 个人知识库管理系统（PK Repository）

> 课程：人工智能导论 / 大语言模型与 RAG 应用 · 计算机系统综合实训
> 团队：YAL（后端/AI 核心）、dashuai-yan（前端/可视化）、Aaiiu（数据工程/联调）
> 项目周期：2026.07.19 — 2026.08.20

基于 **RAG（检索增强生成）** 架构的个人知识库管理系统：上传 PDF / DOCX / PPTX / MD / TXT 文档后，系统自动完成解析、分块、向量化入库，并利用大语言模型自动构建**知识图谱**，最终通过带来源标注的流式对话界面提供智能问答。

---

## 一、核心功能

| 模块 | 功能 |
|---|---|
| 知识库管理 | 多知识库创建/编辑/删除/导出、五种格式文档导入、文档列表/全文搜索/重命名 |
| 知识图谱 | LLM 自动概念提取 + 关系识别、力导向图可视化、节点浮窗、图谱→文档定位跳转 |
| AI 对话 | 三种场景（文档内 / 知识库 / 全局）RAG 问答、SSE 逐字流式输出、来源标注、推荐追问、多轮对话 |
| 文档阅读 | PDF 内嵌预览、DOCX 排版还原、PPT 幻灯片图片、Markdown 渲染、分页导航 |

**实测效果**（课程报告数据）：

- 17 页 PPTX 解析入库 → 17 页阅读文本 + 向量块，PPT 可转图片完整还原幻灯片
- 计算机组成原理知识库自动构建 **28 个概念节点 / 63 条关系**
- 增量分析去重合并生效：新增文档后 17 → 22 节点，3 次分析概念表 0 重复
- RAG 问答流式输出 + 来源标注（如 `[来源: 《CNN入门》P5]`）+ 自动追问

## 二、技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 + Vite + TypeScript + Ant Design 6 + Zustand |
| 图谱可视化 | D3.js v7 力导向图 |
| 后端 | FastAPI + SQLAlchemy + Pydantic（自动 Swagger 文档） |
| 关系数据库 | SQLite（元数据 / 文档页 / 概念 / 关系 / 对话历史） |
| 向量数据库 | ChromaDB（按 `kb_id` 元数据过滤隔离检索） |
| Embedding | BGE-M3 本地（FlagEmbedding，1024 维，GPU 加速） |
| LLM | DeepSeek API（主力）；架构预留 Qwen 本地切换 |
| 文档解析 | PyMuPDF / python-pptx / python-docx / chardet |
| PPT 图片渲染 | LibreOffice CLI（`--convert-to png`，带缓存） |

## 三、目录结构

```
PKR-repo/
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── main.py           # 应用入口（uvicorn app.main:app）
│   │   ├── core/             # 配置 + 数据库连接
│   │   ├── models/           # SQLAlchemy ORM 模型
│   │   ├── schemas/          # Pydantic API 契约
│   │   ├── routers/          # 23 个 API 端点（kbs/docs/graph/chat/search）
│   │   └── services/         # 文档解析、Embedding、ChromaDB、RAG、图谱分析、LLM
│   ├── data/                 # 运行时数据（SQLite + ChromaDB + uploads/）
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # React 前端
│   └── src/                  # pages / components / stores / api
├── mock/                     # Mock 数据（供前端独立开发）
├── scripts/                  # 入库/检索 CLI + 启动脚本
├── projectInfo/              # 各成员工作日志（YAL/XZY/LSC）
├── 项目分工与阶段计划.md
├── 技术栈选择.md
├── 环境搭建指南.md
└── 课程报告.md
```

## 四、环境要求

| 项目 | 要求 |
|---|---|
| Python | 3.10 – 3.13（推荐 3.11，conda 环境） |
| Node.js | ≥ 20（推荐 24 LTS） |
| GPU | 可选（BGE-M3 用 GPU 加速；无 GPU 时改 `EMBEDDING_DEVICE=cpu`） |
| DeepSeek API Key | 必填（对话与图谱分析需要） |
| LibreOffice | 可选（仅 PPT 图片渲染功能需要） |

## 五、快速开始

### 1. 启动后端

```bash
cd backend
pip install -r requirements.txt

# Windows (PowerShell)
$env:DEEPSEEK_API_KEY="sk-你的密钥"

# 启动（首次会自动下载 BGE-M3 模型，约 2GB，请耐心等待）
uvicorn app.main:app --reload --port 8000
```

启动成功后访问：

- Swagger 接口文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

> 也可以直接用现成脚本：`scripts\setup_backend.bat`（建环境+装依赖）、`scripts\start_backend.bat`（启动）

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 （CORS 已放行该地址，无需额外配置）。

### 3. 开始使用

1. **创建知识库**：首页点击"新建知识库"，填写名称/描述/标签
2. **导入文档**：进入知识库 → 拖拽上传 PDF/DOCX/PPTX/MD/TXT → 等待状态变为 `ready`（后台自动解析→分块→向量化→图谱分析，无需人工干预）
3. **AI 对话**：文档页 / 知识库页 / 首页均可提问，回答逐字输出并带 `[来源]` 标注
4. **查看图谱**：图谱页展示自动构建的概念网络，可拖拽/缩放/点击节点查看详情，浮窗中点击文档名可跳转阅读定位

## 六、CLI 脚本（无界面验证用）

```bash
# 入库：解析 → 分块 → Embedding → ChromaDB + SQLite 双写
python scripts/ingest.py 示例.pdf --kb-id kb_demo_001

# 检索：查询向量化 → ChromaDB top-K → Jaccard 去重 → 带来源输出
python scripts/search.py "什么是卷积神经网络" --kb-id kb_demo_001 --top-k 5

# 文档管线冒烟测试：对 uploads 下每种格式验证"解析→分块→去重"链路
# （不需要 Embedding 模型和 API Key，仅需 PyMuPDF/python-pptx/python-docx/chardet/langchain-text-splitters）
python scripts/verify_pipeline.py
```

## 七、API 概览（23 个端点）

| 分类 | 端点 |
|---|---|
| 知识库 | GET/POST `/api/kbs`、PUT/DELETE `/api/kbs/{id}`、GET `/export`、GET `/search`、POST `/reindex` |
| 文档 | POST `/docs/upload`、GET `/docs`、GET/PUT/DELETE `/docs/{id}`、GET `/docs/{id}/content`、GET `/docs/{id}/page-image`、GET `/docs/{id}/file` |
| 图谱 | GET `/graph`、GET `/concepts/{id}/positions`、POST `/analyze`、GET `/analyze/status` |
| 对话 | POST `/api/chat`（SSE）、GET/DELETE `/api/kbs/{id}/chat/history`、GET `/api/chat/history` |
| 检索 | POST `/api/search` |

SSE 流式事件：`source`（来源标注）→ `token`（逐字输出）→ `done`（含推荐追问）/ `error`（错误描述）。

## 八、配置说明（环境变量）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 空 | DeepSeek 密钥（**必填**） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | LLM 服务地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 对话模型 |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Embedding 模型 |
| `EMBEDDING_DEVICE` | `cuda` | 无 GPU 改为 `cpu` |
| `HF_HUB_OFFLINE` | 未设 | 设为 `1` 时离线使用已缓存模型 |

## 九、Docker 部署

```bash
# 在仓库根目录，可选：把 DeepSeek Key 写入 .env 文件
# echo DEEPSEEK_API_KEY=sk-xxx > .env

docker compose up -d --build   # 启动（首次会下载 BGE-M3 模型，约 2GB）
docker compose logs -f backend # 查看日志
docker compose down            # 停止
```

后端容器端口 8000，`backend/data`（SQLite + ChromaDB + uploads）挂载卷持久化；HuggingFace 模型缓存默认挂载到 `./.hf_cache`，宿主机已有模型缓存时可设置 `HF_CACHE_DIR` 指向缓存目录复用，避免重复下载：

```bash
HF_CACHE_DIR=~/.cache/huggingface docker compose up -d --build
```

前端为纯静态 SPA，构建后任意静态服务器（如 Nginx）即可托管：

```bash
cd frontend && npm run build   # 产物在 frontend/dist/
```

## 十、常见问题（FAQ）

| 问题 | 解决 |
|---|---|
| 对话提示 API Key 错误 | 检查环境变量 `DEEPSEEK_API_KEY` 是否设置并重启后端 |
| 上传文档后一直 `processing` | 首次启动正在下载 BGE-M3 模型（约 2GB）；后台日志可看到进度 |
| BGE-M3 下载失败/环境受限 | 降级方案：改用 DeepSeek Embedding API（修改 `embedding_service.py` 中服务实现，一行切换） |
| 扫描版 PDF 无法解析 | 无文字层的 PDF 不支持（需 OCR），系统会明确标记解析失败 |
| PPT 图片不显示 | 需要本机安装 LibreOffice（图片渲染依赖其命令行转换） |
| 无 GPU 时 Embedding 报 CUDA 错误 | 设置 `EMBEDDING_DEVICE=cpu` |
| 上传提示文件类型不支持 | 仅支持 PDF / DOCX / PPTX / MD / TXT |

## 十一、团队分工

| 成员 | 职责 |
|---|---|
| YAL（A） | FastAPI 后端、SQLAlchemy 模型、API 契约、DeepSeek 封装、SSE 流式框架 |
| dashuai-yan（B） | React 前端全部界面、Zustand 状态、D3 图谱交互、文档阅读器、对话面板 |
| Aaiiu（C） | 文档解析与分块、ChromaDB 集成、BGE-M3 部署、RAG 检索管线、图谱分析、双写一致性、联调测试、部署文档 |

> 详细分工与阶段计划见 [项目分工与阶段计划.md](项目分工与阶段计划.md)，技术选型理由见 [技术栈选择.md](技术栈选择.md)，完整实现与效果评估见 [课程报告.md](课程报告.md)。
