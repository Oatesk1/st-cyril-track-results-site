@echo off
setlocal

set "TRACK_PROJECT=C:\Users\kevin\OneDrive\Personal\St. Cyril\Track\track_data_pipeline"
set "SOURCE_JSON=%TRACK_PROJECT%\athlete_records.json"
set "SITE_JSON=C:\Users\kevin\athlete-records-starter\athlete_records.json"

echo Running track report...
call "%TRACK_PROJECT%\Run_Track_Report.bat"
if errorlevel 1 (
    echo.
    echo Report generation failed. Data file was not updated.
    exit /b 1
)

if not exist "%SOURCE_JSON%" (
    echo.
    echo Could not find source file: %SOURCE_JSON%
    exit /b 1
)

echo Copying latest athlete data into website folder...
copy /Y "%SOURCE_JSON%" "%SITE_JSON%" >nul
if errorlevel 1 (
    echo.
    echo Copy failed.
    exit /b 1
)

echo.
echo Done. Website data is updated.
echo Refresh your browser to see new results.
