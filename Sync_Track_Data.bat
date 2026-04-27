@echo off
setlocal EnableDelayedExpansion

set "TRACK_PROJECT=C:\Users\kevin\OneDrive\Personal\St. Cyril\Track\track_data_pipeline"
set "TRACK_PYTHON=%TRACK_PROJECT%\.venv\Scripts\python.exe"
set "TRACK_INGEST=%TRACK_PROJECT%\ingest.py"
set "SOURCE_JSON=%TRACK_PROJECT%\athlete_records.json"
set "SITE_JSON=C:\Users\kevin\athlete-records-starter\athlete_records.json"
set "SOURCE_XLSX=%TRACK_PROJECT%\team_results_highlighted.xlsx"

echo Running track report...
if not exist "%TRACK_PYTHON%" (
    echo.
    echo Python environment not found: %TRACK_PYTHON%
    exit /b 1
)

if not exist "%TRACK_INGEST%" (
    echo.
    echo Could not find ingest.py: %TRACK_INGEST%
    exit /b 1
)

pushd "%TRACK_PROJECT%"
"%TRACK_PYTHON%" "%TRACK_INGEST%"
set "REPORT_EXIT=%ERRORLEVEL%"
popd

if not "%REPORT_EXIT%"=="0" (
    echo.
    echo Report generation failed. Data file was not updated.
    exit /b 1
)

if not exist "%SOURCE_JSON%" (
    echo.
    echo Could not find source file: %SOURCE_JSON%
    exit /b 1
)

if exist "%SOURCE_XLSX%" (
    set "STAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
    set "STAMP=!STAMP: =0!"
    set "STAMP=!STAMP::=!"
    set "ARCHIVE_XLSX=%TRACK_PROJECT%\team_results_highlighted_!STAMP!.xlsx"
    echo Saving timestamped Excel archive...
    copy /Y "%SOURCE_XLSX%" "!ARCHIVE_XLSX!" >nul
    if errorlevel 1 (
        echo.
        echo Warning: Could not create archive workbook copy.
    ) else (
        echo Saved: !ARCHIVE_XLSX!
    )
) else (
    echo.
    echo Warning: Excel workbook not found: %SOURCE_XLSX%
)

echo Copying latest athlete data into website folder...
copy /Y "%SOURCE_JSON%" "%SITE_JSON%" >nul
if errorlevel 1 (
    echo.
    echo Copy failed.
    exit /b 1
)

echo.
echo Updating regional qualifiers from all regional meet raw results...
python "%~dp0build_regional_qualifiers.py"
if errorlevel 1 (
    echo.
    echo Warning: Regional qualifiers refresh failed.
    echo athlete_records.json was still updated successfully.
)

echo.
echo Done. Website data is updated.
echo Refresh your browser to see new results.
