Set oShell = CreateObject("Shell.Application")
oShell.ShellExecute "sc.exe", "start aehd", "", "runas", 0
WScript.Sleep 4000
