@echo off
REM ============================================================
REM PKR 后端启动脚本（Windows）
REM 用法：双击运行，或在 cmd 中执行 scripts\start_backend.bat
REM ============================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0..\backend"

REM --- 检查 DeepSeek API Key ---
if "%DEEPSEEK_API_KEY%"=="" (
    echo 未检测到 DEEPSEEK_API_KEY 环境变量。
    set /p KEY_INPUT=请输入 DeepSeek API Key（sk-...，直接回车则跳过）:
    if not "!KEY_INPUT!"=="" (
        setx DEEPSEEK_API_KEY "!KEY_INPUT!" >nul
        set "DEEPSEEK_API_KEY=!KEY_INPUT!"
    )
)

REM --- 无 GPU 时自动降级 CPU ---
python -c "import torch; assert torch.cuda.is_available()" >nul 2>nul
if %errorlevel% neq 0 (
    echo 未检测到可用 GPU，Embedding 将以 CPU 模式运行（速度较慢）
    set "EMBEDDING_DEVICE=cpu"
)

REM --- 激活 conda 环境（若存在）---
where conda >nul 2>nul
if %errorlevel%==0 (
    call conda activate pk_repo >nul 2>nul
)

echo 启动后端服务：http://localhost:8000
echo Swagger 文档：http://localhost:8000/docs
echo 按 Ctrl+C 停止
echo.

uvicorn app.main:app --reload --port 8000

endlocal
