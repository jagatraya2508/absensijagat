Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
html = folder & "\index.html"
uri = "file:///" & Replace(html, "\", "/")

Function FileExists(path)
    FileExists = fso.FileExists(path)
End Function

Function FindBrowser(exeName)
    Dim paths(4)
    paths(0) = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\" & exeName
    paths(1) = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\" & exeName
    paths(2) = sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Microsoft\Edge\Application\" & exeName
    paths(3) = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\" & exeName
    paths(4) = sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\" & exeName

    Dim i
    For i = 0 To UBound(paths)
        If FileExists(paths(i)) Then
            FindBrowser = paths(i)
            Exit Function
        End If
    Next
    FindBrowser = ""
End Function

edge = FindBrowser("msedge.exe")
chrome = FindBrowser("chrome.exe")

On Error Resume Next
If edge <> "" Then
    sh.Run """" & edge & """ --app=""" & uri & """ --window-size=560,860", 1, False
ElseIf chrome <> "" Then
    sh.Run """" & chrome & """ --app=""" & uri & """ --window-size=560,860", 1, False
Else
    sh.Run "explorer.exe """ & html & """", 1, False
End If
