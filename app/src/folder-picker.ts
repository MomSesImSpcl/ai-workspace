import { execFile } from 'node:child_process';

// Browsers never reveal a picked folder's full path, so the server opens the OS folder dialog itself.

export class PickerUnavailable extends Error {}

// Windows: the Explorer-style folder dialog (IFileOpenDialog with FOS_PICKFOLDERS), via inline C#.
// A hidden topmost owner keeps the dialog in front of the browser.
const windowsScript = `[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialog {}
[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem {
  void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
  void GetParent(out IShellItem ppsi);
  void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
}
[ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileDialog {
  [PreserveSig] int Show(IntPtr parent);
  void SetFileTypes(uint count, IntPtr specs);
  void SetFileTypeIndex(uint index);
  void GetFileTypeIndex(out uint index);
  void Advise(IntPtr events, out uint cookie);
  void Unadvise(uint cookie);
  void SetOptions(uint fos);
  void GetOptions(out uint fos);
  void SetDefaultFolder(IShellItem item);
  void SetFolder(IShellItem item);
  void GetFolder(out IShellItem item);
  void GetCurrentSelection(out IShellItem item);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
  void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
  void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
  void GetResult(out IShellItem item);
}
public static class FolderPicker {
  public static string Pick(IntPtr owner) {
    var d = (IFileDialog)new FileOpenDialog();
    d.SetOptions(0x20 | 0x40); // FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM
    d.SetTitle("Select the project folder");
    if (d.Show(owner) != 0) return null; // cancelled
    IShellItem item;
    d.GetResult(out item);
    string path;
    item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
    return path;
  }
}
'@
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; Opacity = 0; StartPosition = 'CenterScreen' }
$owner.Show(); $owner.Activate()
$path = [FolderPicker]::Pick($owner.Handle)
if ($path) { [Console]::Out.Write($path) }`;

const commands: Record<string, [string, string[]][]> = {
  win32: [['powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', windowsScript]]],
  darwin: [['osascript', ['-e', 'POSIX path of (choose folder with prompt "Select the project folder")']]],
  // Linux: whichever dialog tool the desktop has.
  linux: [
    ['zenity', ['--file-selection', '--directory', '--title=Select the project folder']],
    ['kdialog', ['--getexistingdirectory', '.', '--title', 'Select the project folder']],
  ],
};

function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string } | null> {
  return new Promise((done, fail) =>
    execFile(cmd, args, { windowsHide: true }, (e, out, err) => {
      if ((e as NodeJS.ErrnoException | null)?.code === 'ENOENT') return done(null); // tool not installed
      if (e && typeof e.code !== 'number') return fail(e);
      done({ code: typeof e?.code === 'number' ? e.code : 0, out: out.trim(), err: err.trim() });
    }));
}

// Resolves to the chosen absolute path, or null when the user cancels.
export async function pickFolder(): Promise<string | null> {
  for (const [cmd, args] of commands[process.platform] ?? []) {
    const r = await run(cmd, args);
    if (!r) continue;
    if (r.out) return r.out.length > 1 ? r.out.replace(/\/$/, '') : r.out; // osascript adds a trailing slash
    if (r.code === 0 || r.code === 1) return null; // dialogs exit 0 (Windows) or 1 (others) when cancelled
    throw new Error(`folder dialog failed: ${r.err || `exit ${r.code}`}`);
  }
  throw new PickerUnavailable('no folder dialog available on this system; type the path');
}
