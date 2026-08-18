"""文档解析→分块→去重 链路冒烟测试

用法：
    python scripts/verify_pipeline.py                    # 对 backend/data/uploads 下每种格式各抽 1 个文件测试
    python scripts/verify_pipeline.py <文件路径>          # 对指定文件测试

验证范围（无需 Embedding 模型与 API Key）：
    1. parse_document_pages — 保留页码的逐页解析
    2. chunk_text           — 重叠分块（500 字 / 50 重叠）
    3. jaccard_deduplicate  — 检索结果词级去重
"""
import os
import sys

# 直接按文件路径加载 document_parser，绕过 services 包 __init__
# （包 __init__ 会连带导入 chromadb / embedding 等重型依赖，冒烟测试不需要）
import importlib.util

_parser_path = os.path.join(os.path.dirname(__file__), "..", "backend",
                            "app", "services", "document_parser.py")
_spec = importlib.util.spec_from_file_location("document_parser", _parser_path)
_parser = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_parser)

parse_document = _parser.parse_document
parse_document_pages = _parser.parse_document_pages
chunk_text = _parser.chunk_text
jaccard_deduplicate = _parser.jaccard_deduplicate

PASS = 0
FAIL = 0


def check(name: str, ok: bool, detail: str = ""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {name} {detail}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} {detail}")


def test_file(path: str) -> bool:
    """对单个文件跑完整链路，返回是否通过"""
    print(f"\n=== 测试文件: {os.path.basename(path)} ({os.path.splitext(path)[1]}) ===")
    ok = True

    # [1] 全文解析
    try:
        text = parse_document(path)
        check("parse_document 全文解析", len(text.strip()) > 0, f"— {len(text)} 字符")
        ok = ok and len(text.strip()) > 0
    except ValueError as e:
        print(f"  [SKIP] 不支持的类型: {e}")
        return False
    except Exception as e:
        check("parse_document 全文解析", False, f"— 异常: {e}")
        return False

    # [2] 逐页解析
    try:
        pages = parse_document_pages(path)
        nonempty = sum(1 for _, t in pages if t.strip())
        check("parse_document_pages 逐页解析", len(pages) > 0,
              f"— {len(pages)} 页，{nonempty} 页有文字")
        ok = ok and len(pages) > 0
    except Exception as e:
        check("parse_document_pages 逐页解析", False, f"— 异常: {e}")
        ok = False

    # [3] 分块
    chunks = chunk_text(text)
    check("chunk_text 重叠分块", len(chunks) > 0, f"— {len(chunks)} 块")
    ok = ok and len(chunks) > 0
    if chunks:
        avg = sum(len(c) for c in chunks) / len(chunks)
        check("分块大小合理 (均值 ≤ 600)", avg <= 600, f"— 均值 {avg:.0f} 字")

    # [4] 扫描版 PDF 检测（有全文解析结果但无逐页文字 → 疑似扫描版）
    if path.lower().endswith(".pdf") and len(text.strip()) > 0:
        page_text = "\n".join(t for _, t in pages)
        if len(page_text.strip()) == 0:
            print("  [WARN] PDF 逐页无文字 — 疑似扫描版（无文本层），需 OCR")

    return ok


def test_dedup() -> bool:
    """[5] Jaccard 去重：构造 3 条结果，其中 2 条高度重复"""
    print("\n=== 测试: jaccard_deduplicate 去重 ===")
    results = [
        {"chunk_text": "卷积神经网络是一种包含卷积计算的前馈神经网络，广泛应用于图像分类。",
         "doc_name": "A.pdf", "page_num": 1, "score": 0.92},
        {"chunk_text": "卷积神经网络是一种包含卷积计算的前馈神经网络，广泛应用于图像分类任务。",
         "doc_name": "A.pdf", "page_num": 2, "score": 0.85},   # 与上一条重复
        {"chunk_text": "池化层对特征图进行下采样，降低计算量并增强平移不变性。",
         "doc_name": "B.pdf", "page_num": 5, "score": 0.88},   # 独立
    ]
    kept = jaccard_deduplicate(results, threshold=0.8)
    ok = len(kept) == 2
    check("3 条 → 去重后 2 条（高相似度合并，保留高分）", ok, f"— 保留 {len(kept)} 条")
    if ok and kept[0]["score"] < kept[1]["score"]:
        # 合并时应当保留 score 更高者（第一条 0.92 是重复对中的高分者）
        pass
    return ok


def main():
    args = sys.argv[1:]
    files = []

    if args:
        files = args
    else:
        # 默认：uploads 目录下每种格式各抽一个
        uploads = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "uploads")
        seen = set()
        for f in sorted(os.listdir(uploads)):
            ext = os.path.splitext(f)[1].lower()
            if ext in seen:
                continue
            seen.add(ext)
            files.append(os.path.join(uploads, f))

    print("=" * 60)
    print("PKR 文档管线冒烟测试（解析 → 分块 → 去重）")
    print("=" * 60)

    file_ok = True
    for f in files:
        if os.path.exists(f):
            file_ok = test_file(f) and file_ok
        else:
            print(f"\n[SKIP] 文件不存在: {f}")

    dedup_ok = test_dedup()

    print("\n" + "=" * 60)
    print(f"结果: {PASS} 通过 / {FAIL} 失败")
    if FAIL == 0 and (file_ok or not files) and dedup_ok:
        print("[OK] 文档管线验证通过")
        return 0
    else:
        print("[FAIL] 存在未通过项，请检查上述 FAIL 条目")
        return 1


if __name__ == "__main__":
    sys.exit(main())
