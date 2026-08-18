@echo off
REM ============================================================
REM PKR 前端启动脚本（Windows）
REM 用法：双击运行，或在 cmd 中执行 scripts\start_frontend.bat
REM ============================================================
chcp 65001 >nul
setlocal

cd /d "%~dp0..\frontend"

if not exist node_modules (
    echo [1/2] 首次运行，安装前端依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
) else (
    echo [1/2] 依赖已安装，跳过
)

echo [2/2] 启动前端开发服务器：http://localhost:5173
echo 按 Ctrl+C 停止
echo.

call npm run dev

endlocal
