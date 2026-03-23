Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = Chr(34) & base & "\\INICIAR-AGUIA-SERVIDOR.bat" & Chr(34)
shell.Run cmd, 0, False
