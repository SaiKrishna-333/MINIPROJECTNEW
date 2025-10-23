@echo off
echo ========================================
echo Rural Gold Connect - ML Setup
echo ========================================
echo.
echo This will install ML dependencies for:
echo  - Face Recognition (face-api.js)
echo  - OCR (Tesseract.js)
echo  - Image Processing (Canvas)
echo.
echo Requirements: ~500MB disk space
echo.
pause

echo Installing dependencies...
echo.
npm install @vladmandic/face-api@1.7.12 @tensorflow/tfjs-node@4.11.0 canvas@2.11.2 tesseract.js@5.0.4

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ERROR: Installation failed!
    echo ========================================
    echo.
    echo Possible solutions:
    echo 1. Free up disk space (need ~500MB)
    echo 2. Check internet connection
    echo 3. Run as Administrator
    echo.
    echo To free disk space:
    echo - Delete temp files: %%temp%%
    echo - Empty Recycle Bin
    echo - Run Disk Cleanup
    echo.
    pause
    exit /b 1
)

echo.
echo Downloading ML models...
node scripts/download-models.js

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next: Run "npm run dev" to start server
echo.
pause
