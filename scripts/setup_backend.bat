@echo off
REM ============================================================
REM PKR 后端环境搭建脚本（Windows）
REM 优先使用 conda 创建 pk_repo 环境；无 conda 时退回系统 pip
REM 用法：双击运行，或在 cmd 中执行 scripts\setup_backend.bat
REM ============================================================
chcp 65001 >nul
setlocal

cd /d "%~dp0..\backend"

where conda >nul 2>nul
if %errorlevel%==0 (
    echo [1/3] 创建/复用 conda 环境 pk_repo (Python 3.11)...
    call conda activate pk_repo >nul 2>nul
    if %errorlevel%==0 (
        echo       环境已存在，直接复用
    ) else (
        call conda create -n pk_repo python=3.11 -y
        call conda activate pk_repo
    )
) else (
    echo [1/3] 未检测到 conda，使用系统 Python
)

echo [2/3] 安装 Python 依赖（首次约需数分钟）...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络或 pip 源
    pause
    exit /b 1
)

echo [3/3] 验证关键依赖...
python -c "import fastapi, uvicorn, sqlalchemy, chromadb, fitz, pptx, docx, chardet; print('       全部导入成功')"
if %errorlevel% neq 0 (
    echo [错误] 依赖验证失败
    pause
    exit /b 1
)

echo.
echo [OK] 环境搭建完成。
echo      下一步：配置 DEEPSEEK_API_KEY 环境变量，然后运行 scripts\start_backend.bat
pause
