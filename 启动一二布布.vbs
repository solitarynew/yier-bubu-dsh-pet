' Launch without a terminal window. Logs remain in the project-local .runtime folder.
Option Explicit
Dim shell, files, root, node, runtime, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(node) Then node = "node.exe"
runtime = root & "\.runtime"
If Not files.FolderExists(runtime) Then files.CreateFolder(runtime)
command = "cmd.exe /d /s /c " & Chr(34) & Chr(34) & node & Chr(34) & " " & Chr(34) & root & "\scripts\install.mjs" & Chr(34) & " >> " & Chr(34) & runtime & "\launcher.log" & Chr(34) & " 2>&1" & Chr(34)
shell.Run command, 0, False
