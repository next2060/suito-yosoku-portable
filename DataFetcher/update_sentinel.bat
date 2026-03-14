@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===================================================
echo   水稲生育システム (Sentinel-2 データ取得)
echo ===================================================
echo.

:: 持ち運び版（WinPython）のPython本体の場所を相対パスで指定
set PYTHON_EXE=WPy64-31241\python-3.12.4.amd64\python.exe

:: Pythonが見つからない場合のエラー処理
if not exist "%PYTHON_EXE%" (
    echo [エラー] Python環境が見つかりません。
    echo 「WPy64-31241」フォルダが同じ階層にあるか確認してください。
    echo.
    pause
    exit /b
)

:: プログラムの実行
"%PYTHON_EXE%" get_sentinel.py

echo.
echo ===================================================
echo   処理が終了しました。画面を閉じます。
echo ===================================================
pause