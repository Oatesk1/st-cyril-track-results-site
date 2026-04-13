@echo off
setlocal
pushd "%~dp0"

call "%~dp0Sync_Track_Data.bat"
if errorlevel 1 (
    echo.
    echo Sync failed. Nothing was published.
    popd
    exit /b 1
)

call "%~dp0Publish_To_GitHub.bat"
if errorlevel 1 (
    echo.
    echo Publish failed.
    popd
    exit /b 1
)

echo.
echo All done: data synced and published.
popd
exit /b 0
