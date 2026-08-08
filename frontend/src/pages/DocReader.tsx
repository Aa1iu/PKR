import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Button, Card, Typography, Tag, Space, InputNumber } from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import MarkdownRenderer from '../components/MarkdownRenderer';
import PdfPageRenderer from '../components/PdfPageRenderer';
import type { Doc } from '../types';

const { Title, Text } = Typography;

// ========== Mock 数据（Phase 2 替换为 API 调用） ==========

interface MockDocData {
  doc: Doc;
  pages: string[];
}

/** 按 docId 索引的 Mock 文档，模拟 GET /api/kbs/{kb_id}/docs/{doc_id}/content */
const MOCK_DATA: Record<string, MockDocData> = {
  // ===== PDF 文档：PyMuPDF 提取的纯文本效果 =====
  doc_001: {
    doc: {
      doc_id: 'doc_001',
      filename: '卷积神经网络综述.pdf',
      type: 'pdf',
      pages: 4,
      size: '2.4 MB',
      status: 'analyzed',
      created_at: '2026-07-22',
    },
    pages: [
      // 第 1 页
      [
        '卷积神经网络综述',
        '',
        '摘要',
        '',
        '卷积神经网络（Convolutional Neural Network, CNN）是深度学习领域最具影响力的架构之一。本文从数学原理、经典架构演进和工程实践三个维度，系统梳理了 CNN 的核心知识体系。文章首先介绍卷积运算的数学定义及其在神经网络中的实现方式，随后详细分析池化层、激活函数等关键组件的作用机制，最后对 LeNet-5、AlexNet、VGGNet、ResNet 等里程碑架构进行对比分析，并展望 CNN 与 Transformer 融合的发展趋势。',
        '',
        '关键词：卷积神经网络；深度学习；图像识别；特征提取；残差网络',
        '',
        '1 引言',
        '',
        '卷积神经网络是一类包含卷积计算且具有深度结构的前馈神经网络[1]。自 2012 年 AlexNet 在 ImageNet 竞赛中取得突破性成绩以来，CNN 已成为计算机视觉领域的基础架构，广泛应用于图像分类、目标检测、语义分割、人脸识别、医学影像分析等场景。',
        '',
        'CNN 的核心设计思想可归纳为两点：局部感知（Local Connectivity）和权值共享（Weight Sharing）。与全连接网络不同，CNN 通过卷积核在输入数据上滑动完成特征提取，每次仅处理一个局部感受野，这大幅降低了参数规模。例如，处理 224×224 像素的 RGB 图像，全连接层需要约 15 万个参数，而 3×3 卷积核仅需 27 个参数（不含偏置），参数效率提升了数千倍。',
      ].join('\n'),
      // 第 2 页
      [
        '2 核心组件',
        '',
        '一个典型的 CNN 架构由卷积层、池化层和全连接层三种基本结构交替堆叠而成。其中卷积层负责特征提取，池化层执行下采样以降维和增强平移不变性，全连接层则在网络末端完成最终的分类或回归决策。',
        '',
        '2.1 卷积层',
        '',
        '卷积层是 CNN 的核心构建块。在数学上，二维离散卷积定义为输入矩阵 I 与卷积核 K 的逐元素乘加运算。在深度学习框架中，通常以互相关（Cross-Correlation）操作代替严格的数学卷积，两者在效果上等价，而互相关实现更为高效。',
        '',
        '卷积层涉及四个关键超参数：卷积核大小（Kernel Size）决定每次运算的局部区域尺寸，常用 3×3 或 5×5；步长（Stride）控制卷积核滑动的像素间隔，取 1 时逐像素移动，取 2 时实现下采样；填充（Padding）策略影响输出特征图的空间尺寸，"same"填充在输入边缘补零以保持输入输出尺寸一致；滤波器数量（Filters）即输出通道数，决定了该层提取的特征图种类。',
        '',
        '2.2 池化层',
        '',
        '池化层对特征图进行空间下采样，主要目的包括三个方面：一是降低特征图尺寸以减少后续层的计算开销；二是提供一定的局部平移不变性；三是扩大后续层神经元的有效感受野。实践中最大池化（Max Pooling）使用最为广泛，它在每个滑动窗口内取最大值作为输出，倾向于保留最显著的特征响应。平均池化（Average Pooling）则取窗口内平均值，在需要保留整体背景信息的场景中更为适用。',
      ].join('\n'),
      // 第 3 页
      [
        '2.3 激活函数',
        '',
        '激活函数为网络引入非线性变换能力。若无激活函数，多层线性变换的复合仍等价于单一线性变换，深层网络将退化为浅层模型的表达能力。',
        '',
        'ReLU（Rectified Linear Unit）是当前 CNN 中最常用的激活函数，其定义为 f(x) = max(0, x)。ReLU 计算简单、梯度传播高效，且在 x > 0 区间避免了 Sigmoid 和 Tanh 的梯度饱和问题。然而 ReLU 在 x < 0 时梯度恒为零，可能导致部分神经元永久失活，这一现象被称为"死亡 ReLU"问题。',
        '',
        '针对 ReLU 的缺陷，研究者提出了多种改进方案。LeakyReLU 在负半轴赋予一个极小的斜率（如 α = 0.01），使负值区域仍能保持微弱的梯度流动。GELU（Gaussian Error Linear Unit）则在 Transformer 架构中得到了广泛应用，其平滑的非线性特性在某些任务上优于 ReLU。',
        '',
        '3 经典架构演进',
        '',
        'CNN 架构在近三十年里经历了数次重要迭代，每次突破都推动了计算机视觉边界的扩展。LeNet-5（1998 年，Yann LeCun）虽仅七层，却奠定了"卷积—池化—全连接"的基础范式，在手写数字识别任务上取得了商用级效果。AlexNet（2012 年，Krizhevsky 等）以八层架构在 ImageNet 上将 Top-5 错误率降至 15.3%，标志着深度学习时代的正式开启，其关键创新包括使用 ReLU 激活、Dropout 正则化和 GPU 并行训练。',
      ].join('\n'),
      // 第 4 页
      [
        'VGGNet（2014 年，Simonyan 与 Zisserman）的核心贡献在于证明了网络深度对性能的决定性作用。它摒弃了大尺寸卷积核，转而使用连续的 3×3 小卷积核堆叠——两层 3×3 卷积的感受野等价于一层 5×5 卷积，但参数更少、非线性更强。VGG-16 和 VGG-19 在 ImageNet 上分别将 Top-5 错误率压缩至 7.3% 和 7.0%，但其全连接层带来了巨大的参数量（约 138M），导致模型体积庞大且容易过拟合。',
        '',
        'ResNet（2015 年，He 等）引入残差连接（Skip Connection）解决了深层网络的退化难题。在传统 CNN 中，当网络深度超过一定阈值后，训练误差反而随深度增加而上升——这并非过拟合导致，而是优化困难造成的退化。ResNet 通过在每两层（或三层）卷积间添加恒等映射捷径，将学习目标从直接拟合 H(x) 转变为拟合残差 F(x) = H(x) - x。当最优映射接近恒等时，残差块只需将 F(x) 逼近零即可，这比直接学习恒等映射容易得多。借助残差连接，ResNet-152 以 152 层的深度将 Top-5 错误率压低至 4.5%，首次超越了人类水平的图像识别能力。',
        '',
        '4 发展趋势与展望',
        '',
        '当前 CNN 的研究前沿正在从"更深更宽"的堆叠范式转向效率与可解释性的平衡。轻量化架构如 MobileNet（深度可分离卷积）和 ShuffleNet（通道混洗）使 CNN 得以部署在移动端和嵌入式设备上；注意力机制的引入（SENet 的通道注意力、CBAM 的通道-空间联合注意力）赋予网络"关注重点"的能力；而 Vision Transformer（ViT, 2020）的成功则开启了 CNN 与 Transformer 融合的新方向。',
      ].join('\n'),
    ],
  },

  // ===== DOCX 文档：python-docx 提取的纯文本效果 =====
  doc_002: {
    doc: {
      doc_id: 'doc_002',
      filename: '反向传播推导过程.docx',
      type: 'docx',
      pages: 3,
      size: '1.1 MB',
      status: 'analyzed',
      created_at: '2026-07-23',
    },
    pages: [
      [
        '反向传播算法详解',
        '',
        '反向传播（Backpropagation）是训练多层神经网络的核心算法。它利用链式法则，将输出层的误差逐层向前传播，计算出每个参数对损失函数的梯度，从而支持基于梯度的优化方法（如 SGD、Adam）更新网络权重。',
        '',
        '1 前向传播回顾',
        '',
        '在理解反向传播之前，首先回顾前向传播过程。对于第 l 层的神经元，其输出由以下公式给出：z(l) = W(l) * a(l-1) + b(l)，a(l) = f(z(l))，其中 W(l) 为权重矩阵，b(l) 为偏置向量，f 为激活函数，a(l-1) 为上一层的激活输出。',
        '',
        '输入数据从第一层开始，逐层向前计算，最终在输出层得到网络的预测值。损失函数 L 衡量预测值与真实标签之间的差距——常用的损失函数包括均方误差（MSE，回归任务）和交叉熵损失（Cross-Entropy，分类任务）。',
        '',
        '2 反向传播的链式法则',
        '',
        '反向传播的核心数学工具是多元微积分中的链式法则。设损失 L 依赖于输出 a(L)，而 a(L) 又依赖于前一层的输出和参数，则各层参数的梯度可以递归地表示为：∂L/∂W(l) = ∂L/∂a(l) * ∂a(l)/∂z(l) * ∂z(l)/∂W(l)。',
      ].join('\n'),
      [
        '3 逐层反向计算',
        '',
        '反向传播从输出层开始，逐层向前计算。第一步：计算输出层误差。δ(L) = ∇a(L) L ⊙ f\'(z(L))，其中 ⊙ 表示逐元素乘法（Hadamard 积），∇a(L) L 为损失函数对输出层激活值的梯度。',
        '',
        '第二步：反向传播误差。对于隐藏层 l（l = L-1, L-2, ..., 1），有递推公式：δ(l) = [(W(l+1))T * δ(l+1)] ⊙ f\'(z(l))。该公式将第 l+1 层的误差 δ(l+1) 通过权重矩阵的转置传播回第 l 层，再乘以该层激活函数的导数。',
        '',
        '第三步：计算参数梯度。得到各层误差 δ(l) 后，权重和偏置的梯度分别为：∂L/∂W(l) = δ(l) * (a(l-1))T 和 ∂L/∂b(l) = δ(l)。这些梯度随后被传递给优化器，用于更新参数。',
        '',
        '4 激活函数的梯度特性',
        '',
        '激活函数的导数直接影响反向传播的梯度流动。Sigmoid 函数的导数为 σ\'(x) = σ(x)(1 - σ(x))，在输入绝对值较大时，导数值趋近于零，容易导致梯度消失。ReLU 的导数在正区间恒为 1，有效缓解了这一问题，但在负区间导数为 0，可能导致神经元死亡。',
      ].join('\n'),
      [
        '5 数值稳定性与工程实践',
        '',
        '在实际工程中，深度网络的反向传播面临梯度消失（Vanishing Gradient）和梯度爆炸（Exploding Gradient）两大挑战。梯度消失常见于 Sigmoid/Tanh 激活函数的深层网络中，由于导数值小于 1 的逐层连乘，浅层梯度急剧衰减至零，导致参数几乎不更新。梯度爆炸则相反，当权重初始化不当或网络结构设计不合理时，梯度在传播过程中指数级增长，导致参数更新幅度过大、训练发散。',
        '',
        '工程上常用的缓解策略包括：使用 ReLU 及其变体（LeakyReLU、ELU）作为激活函数；采用 Xavier 或 He 初始化方法合理设置权重初值；引入 Batch Normalization 在各层输入处进行标准化以稳定梯度流动；以及应用梯度裁剪（Gradient Clipping）将梯度范数限制在预设阈值内。',
        '',
        '6 总结',
        '',
        '反向传播算法是连接损失函数与参数更新的桥梁，其本质是对计算图执行链式求导。理解反向传播不仅有助于调试训练过程中的梯度问题，也为设计新型网络架构和损失函数提供了理论基础。现代深度学习框架（PyTorch、TensorFlow）已内置自动微分引擎，开发者无需手动推导梯度，但理解其底层原理仍是进阶的必经之路。',
      ].join('\n'),
    ],
  },

  // ===== Markdown 文档：原始 Markdown 文本效果 =====
  doc_md: {
    doc: {
      doc_id: 'doc_md',
      filename: '深度学习入门笔记.md',
      type: 'md',
      pages: 5,
      size: '48 KB',
      status: 'analyzed',
      created_at: '2026-07-25',
    },
    pages: [
      [
        '# 深度学习入门笔记',
        '',
        '## 一、引言',
        '',
        '卷积神经网络（**Convolutional Neural Network**，简称 **CNN**）是一类包含卷积计算且具有深度结构的前馈神经网络，是深度学习中最具代表性的算法之一。',
        '',
        'CNN 的核心思想在于**局部感知**和**权值共享**。与传统全连接网络不同，CNN 通过卷积核在输入数据上滑动，每次只处理一个局部区域，这大大减少了参数数量，使得深层网络的训练成为可能。',
        '',
        '> 💡 **关键洞察**：全连接网络处理一张 224×224 的图片需要约 15 万个参数，而卷积层使用 3×3 卷积核仅需 9 个参数（加上偏置），参数效率提升了上万倍。',
        '',
        '## 二、CNN 的核心组件',
        '',
        '一个典型的 CNN 架构由以下三种基本层交替堆叠而成：',
        '',
        '| 层类型 | 作用 | 输出特点 |',
        '|--------|------|----------|',
        '| 卷积层 | 提取局部特征 | 保持空间结构 |',
        '| 池化层 | 下采样降维 | 减少参数量 |',
        '| 全连接层 | 分类决策 | 一维向量 |',
      ].join('\n'),
      [
        '# 深度学习入门笔记',
        '',
        '## 三、卷积运算详解',
        '',
        '### 3.1 关键参数',
        '',
        '| 参数 | 含义 | 常用值 |',
        '|------|------|--------|',
        '| kernel_size | 卷积核大小 | 3×3, 5×5 |',
        '| stride | 滑动步长 | 1, 2 |',
        '| padding | 边缘填充方式 | "same", "valid" |',
        '| filters | 卷积核数量（输出通道数） | 32, 64, 128 |',
        '',
        '### 3.2 代码示例',
        '',
        '```python',
        'import tensorflow as tf',
        '',
        'model = tf.keras.Sequential([',
        '    # 32 个 3×3 卷积核，步长为 1，same 填充',
        '    tf.keras.layers.Conv2D(',
        '        filters=32,',
        '        kernel_size=(3, 3),',
        '        strides=1,',
        '        padding="same",',
        '        activation="relu",',
        '        input_shape=(224, 224, 3)',
        '    ),',
        '    tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),',
        '])',
        '```',
      ].join('\n'),
      [
        '# 深度学习入门笔记',
        '',
        '## 四、池化层与激活函数',
        '',
        '### 4.1 池化层的作用',
        '',
        '池化层（Pooling Layer）对特征图进行**下采样**，主要目的包括：',
        '',
        '- **降维**：减少特征图的空间尺寸，降低后续层的计算量',
        '- **不变性**：提供一定的平移不变性（translation invariance）',
        '- **扩大感受野**：让后续层看到更大的输入区域',
        '',
        '### 4.2 激活函数对比',
        '',
        '```python',
        'import numpy as np',
        '',
        '# ReLU — 最常用的激活函数',
        'def relu(x):',
        '    return np.maximum(0, x)',
        '',
        '# LeakyReLU — 解决"死亡 ReLU"问题',
        'def leaky_relu(x, alpha=0.01):',
        '    return np.where(x > 0, x, alpha * x)',
        '```',
        '',
        '> ⚠️ **注意**：ReLU 在 x < 0 时梯度为零，可能导致神经元"死亡"。',
      ].join('\n'),
      [
        '# 深度学习入门笔记',
        '',
        '## 五、经典 CNN 架构演进',
        '',
        '### 5.1 LeNet-5（1998）',
        '',
        '由 Yann LeCun 提出，用于手写数字识别（MNIST）。结构简单但奠定了 CNN 的基本范式：**卷积 → 池化 → 全连接**。',
        '',
        '### 5.2 AlexNet（2012）',
        '',
        'ImageNet 2012 冠军，标志着深度学习时代的到来。关键创新：',
        '',
        '- 使用 **ReLU** 替代 Sigmoid 作为激活函数',
        '- 引入 **Dropout** 防止过拟合',
        '- 利用 **GPU 并行训练**加速计算',
        '',
        '### 5.3 ResNet（2015）',
        '',
        '引入**残差连接**（Skip Connection），解决了深层网络的退化问题：',
        '',
        '```',
        '输出 = F(输入) + 输入    ← 恒等映射',
        '```',
        '',
        '| 模型 | 年份 | 层数 | Top-5 错误率 | 核心创新 |',
        '|------|------|------|-------------|----------|',
        '| AlexNet | 2012 | 8 | 15.3% | ReLU + Dropout |',
        '| VGG-16 | 2014 | 16 | 7.3% | 小卷积核堆叠 |',
        '| ResNet-152 | 2015 | 152 | 4.5% | 残差连接 |',
      ].join('\n'),
      [
        '# 深度学习入门笔记',
        '',
        '## 六、应用场景与总结',
        '',
        '### 6.1 主要应用领域',
        '',
        '- **图像分类**：对整张图片给出类别标签（如 ImageNet 1000 类）',
        '- **目标检测**：定位并识别图中的多个物体（YOLO、Faster R-CNN）',
        '- **语义分割**：为每个像素分配类别标签（U-Net、DeepLab）',
        '- **人脸识别**：特征提取 + 相似度比对',
        '- **医学影像**：病灶检测、器官分割、疾病诊断',
        '',
        '### 6.2 发展趋势',
        '',
        '> 📈 当前 CNN 的研究方向正从"更深更宽"转向**效率与可解释性**。轻量化架构（MobileNet、ShuffleNet）让 CNN 可以部署在移动设备上，而注意力机制的引入（如 SENet、CBAM）则让网络学会"关注哪里"。',
        '',
        '## 七、本章要点回顾',
        '',
        '1. CNN 通过**局部连接**和**权值共享**大幅减少参数',
        '2. 核心组件：卷积层（特征提取）→ 池化层（下采样）→ 全连接层（分类）',
        '3. 经典架构演进：LeNet → AlexNet → VGG → ResNet → EfficientNet',
        '4. 残差连接是训练超深层网络的关键技术',
        '5. 当前趋势：轻量化 + 注意力 + 与 Transformer 融合',
      ].join('\n'),
    ],
  },
};

// 默认兜底：url 里 docId 未匹配到任何 mock 数据时使用
const FALLBACK_DOC_ID = 'doc_001';

// ========== 渲染器选择 ==========

/** 根据文档类型选择渲染器 */
const getRenderer = (type: Doc['type'], content: string) => {
  switch (type) {
    case 'md':
      // Markdown 文件走 react-markdown + remark-gfm
      return <MarkdownRenderer content={content} />;
    case 'pdf':
    case 'docx':
    case 'txt':
      // 后端 PyMuPDF / python-docx 提取的纯文本
      return <PdfPageRenderer content={content} />;
    case 'pptx':
      // Phase 3: PPTX 截图画廊模式
      return <PdfPageRenderer content={content} />;
    default:
      return <PdfPageRenderer content={content} />;
  }
};

// ========== 组件 ==========

/** 文档阅读器 — 分页浏览文档内容，按文档类型切换渲染器 */
function DocReader() {
  const { docId } = useParams<{ docId: string }>();
  const location = useLocation();
  const statePage = (location.state as { page?: number } | null)?.page;

  // Phase 2: 通过 docId 调用 GET /api/kbs/{kb_id}/docs/{doc_id}/content?page=N
  const data = MOCK_DATA[docId ?? ''] ?? MOCK_DATA[FALLBACK_DOC_ID];
  const { doc, pages } = data;
  const totalPages = pages.length;

  // 从图谱浮窗跳转时，location.state.page 指定定位页（合法范围校验，非法回退第 1 页）
  const [currentPage, setCurrentPage] = useState(() =>
    statePage && statePage >= 1 && statePage <= totalPages ? statePage : 1,
  );
  const contentRef = useRef<HTMLDivElement>(null);

  // 换文档（docId 变化）时重置页码：React 官方「render 期间调整 state」模式，避免 effect 内 setState
  const [prevDocId, setPrevDocId] = useState(docId);
  if (docId !== prevDocId) {
    setPrevDocId(docId);
    setCurrentPage(statePage && statePage >= 1 && statePage <= totalPages ? statePage : 1);
  }

  // 跳页后把内容区滚回顶部完成定位
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [currentPage]);

  console.log('[DocReader] 文档 ID:', docId, '| 类型:', doc.type, '| 页数:', totalPages);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePrev = () => goToPage(currentPage - 1);
  const handleNext = () => goToPage(currentPage + 1);

  const statusMap: Record<Doc['status'], { color: string; label: string }> = {
    processing: { color: 'blue', label: '解析中' },
    analyzed: { color: 'green', label: '已分析' },
    failed: { color: 'red', label: '失败' },
  };

  const typeLabel = doc.type.toUpperCase();

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* ===== 顶部信息栏 ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          marginBottom: 16,
        }}
      >
        <Space align="center">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
          <FileTextOutlined style={{ fontSize: 20, color: 'var(--color-primary)' }} />
          <Title level={4} style={{ margin: 0 }}>
            {doc.filename}
          </Title>
          <Tag>{typeLabel}</Tag>
          <Tag color={statusMap[doc.status].color}>{statusMap[doc.status].label}</Tag>
        </Space>

        <Space>
          <Text type="secondary">{doc.size}</Text>
          <Text type="secondary">·</Text>
          <Text type="secondary">{doc.pages} 页</Text>
          <Text type="secondary">·</Text>
          <Text type="secondary">上传于 {doc.created_at}</Text>
        </Space>
      </div>

      {/* ===== 文档内容区 ===== */}
      <Card
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: 0,
          },
        }}
      >
        {/* 内容滚动容器：跳页后 scrollTo 顶部完成定位 */}
        <div ref={contentRef} style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
          {getRenderer(doc.type, pages[currentPage - 1])}
        </div>
      </Card>

      {/* ===== 底部分页导航 ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexShrink: 0,
          padding: '16px 0 8px',
        }}
      >
        <Button icon={<LeftOutlined />} onClick={handlePrev} disabled={currentPage <= 1}>
          上一页
        </Button>

        <Space size={4}>
          <InputNumber
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(v) => v && goToPage(v)}
            size="small"
            style={{ width: 60 }}
          />
          <Text type="secondary">/ {totalPages}</Text>
        </Space>

        <Button
          icon={<RightOutlined />}
          onClick={handleNext}
          disabled={currentPage >= totalPages}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

export default DocReader;
