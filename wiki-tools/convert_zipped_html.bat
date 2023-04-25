@echo off
if not exist html mkdir html
if not exist images mkdir images
if not exist doku mkdir doku
IF EXIST %1 GOTO PROCESS_FILE
forfiles /p zipped /m *.zip /C "cmd /c %~dp0\convert_zipped_html.bat @path"
exit
:PROCESS_FILE
setlocal enableDelayedExpansion
set obj=%~n1
for %%A in (a b c d e f g h i j k l m n o p q r s t u v w x y z) do (
    set "obj=!obj:%%A=%%A!"
)
set obj=%obj: =_%
set obj=%obj:.=_%
set base=%~dp0html\
set dokufile=%~dp0doku\%obj%.txt
set zip_folder=%base%%obj%
powershell Expand-Archive -Force \"%1\" \"%zip_folder%\"
forfiles /p %zip_folder% /M *.html /C "cmd /c pandoc -i @file -o %dokufile% -f html -t dokuwiki"

for %%f in (%zip_folder%\images\*) do (
	copy %%f %~dp0images\%obj%_%%~nxf
	powershell "((Get-Content -path \"%dokufile%\" -Raw) -replace 'images/%%~nxf','tools:%obj%_%%~nxf') | Set-Content -Path \"%dokufile%\""
)
