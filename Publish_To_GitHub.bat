@echo off
setlocal
pushd "%~dp0"

set "BRANCH=main"

if not exist ".git" (
    echo Initializing git repository...
    git init
    if errorlevel 1 goto :error
)

for /f %%R in ('git remote') do set "HAS_REMOTE=1"
if not defined HAS_REMOTE (
    echo.
    echo No GitHub remote is configured yet.
    echo 1^) Create an empty GitHub repo
    echo 2^) Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    echo 3^) Run this script again
    popd
    exit /b 1
)

git checkout -B %BRANCH%
if errorlevel 1 goto :error

git add .
if errorlevel 1 goto :error

git diff --cached --quiet
if %errorlevel%==0 (
    echo No new changes to publish.
    popd
    exit /b 0
)

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "DATESTAMP=%%a-%%b-%%c"
for /f "tokens=1-2 delims=:" %%h in ("%time%") do set "TIMESTAMP=%%h%%i"
set "COMMIT_MSG=Update track results %DATESTAMP% %TIMESTAMP%"

git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto :error

git push -u origin %BRANCH%
if errorlevel 1 goto :error

echo.
echo Published to GitHub successfully.
echo Netlify will auto-deploy from the new commit.
popd
exit /b 0

:error
echo.
echo Publish failed.
popd
exit /b 1
