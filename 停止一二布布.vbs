Option Explicit
Dim shell, files, root, node
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(node) Then node = "node.exe"
shell.Run Chr(34) & node & Chr(34) & " " & Chr(34) & root & "\scripts\runtime.mjs" & Chr(34) & " stop", 0, False
