@echo off
chcp 65001 > nul

rem 【県庁プロキシ設定】
rem set HTTP_PROXY=http://Z4B04.pref.ibaraki.jp:8000
rem set HTTPS_PROXY=http://Z4B04.pref.ibaraki.jp:8000

rem Pythonスクリプトを起動！（入力画面はPythonの中で出ます）
.\WPy64-31241\python-3.12.4.amd64\python.exe get_amedas.py

echo.
echo 処理が完了しました！何かキーを押すと画面を閉じます。
pause > nul