@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 server.py
  goto :eof
)
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python server.py
  goto :eof
)
echo Python 3 is required to launch Gobbler Gauntlet.
echo Install it from https://www.python.org/downloads/ and try again.
exit /b 1
