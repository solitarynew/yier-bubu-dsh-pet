// Windows only. Current key state, never text: A-Z + Backspace/Tab/Enter/Shift/Esc/Space.
// The stream goes only to the parent Electron process. Nothing is written to disk.
using System;
using System.Diagnostics;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;

namespace YierBubu {
  public static class KeyboardState {
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)] private static extern IntPtr GetModuleHandle(string name);
    [StructLayout(LayoutKind.Sequential)] private struct Message { public IntPtr window; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public int x, y; public uint reserved; }
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message message, IntPtr window, uint min, uint max, uint remove);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
    private static readonly int[] keys = {65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,8,9,13,16,27,32};
    private static readonly ConcurrentQueue<uint> frames = new ConcurrentQueue<uint>();
    private static readonly HookProc callback = OnKey;
    private static IntPtr hook;
    private static uint mask;
    private static bool leftShift, rightShift;
    private static IntPtr OnKey(int code, IntPtr message, IntPtr data) {
      if (code >= 0) {
        int type = message.ToInt32();
        if (type == 0x100 || type == 0x104 || type == 0x101 || type == 0x105) {
          int key = Marshal.ReadInt32(data);
          bool down = type == 0x100 || type == 0x104;
          if (key == 160) { leftShift = down; key = 16; down = leftShift || rightShift; }
          else if (key == 161) { rightShift = down; key = 16; down = leftShift || rightShift; }
          int index = Array.IndexOf(keys, key);
          if (index >= 0) {
            uint next = down ? mask | (1u << index) : mask & ~(1u << index);
            // No text decoding, logging, file I/O or input suppression in this callback.
            if (next != mask) { mask = next; if (frames.Count < 512) frames.Enqueue(mask); }
          }
        }
      }
      return CallNextHookEx(hook, code, message, data);
    }
    public static void Run(int parentId) {
      uint previous = UInt32.MaxValue;
      var clock = Stopwatch.StartNew();
      long checkedParent = -1000, sent = -1000;
      hook = SetWindowsHookEx(13, callback, GetModuleHandle(null), 0);
      if (hook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        while (true) {
          Message message;
          while (PeekMessage(out message, IntPtr.Zero, 0, 0, 1)) {
            if (message.message == 0x12) return;
            TranslateMessage(ref message); DispatchMessage(ref message);
          }
          if (clock.ElapsedMilliseconds - checkedParent >= 500) {
            checkedParent = clock.ElapsedMilliseconds;
            try { using (var parent = Process.GetProcessById(parentId)) { if (parent.HasExited) return; } }
            catch (ArgumentException) { return; }
          }
          uint queued;
          while (frames.TryDequeue(out queued)) {
            Console.WriteLine(queued.ToString(System.Globalization.CultureInfo.InvariantCulture));
            previous = queued; sent = clock.ElapsedMilliseconds;
          }
          if (clock.ElapsedMilliseconds - sent >= 1000 || previous == UInt32.MaxValue) {
            // Recover key-up state after desktop switches or lost events, using only the high bit.
            mask = 0;
            for (int i = 0; i < keys.Length; i++) if (GetAsyncKeyState(keys[i]) < 0) mask |= 1u << i;
            leftShift = GetAsyncKeyState(160) < 0; rightShift = GetAsyncKeyState(161) < 0;
            Console.WriteLine(mask.ToString(System.Globalization.CultureInfo.InvariantCulture));
            previous = mask; sent = clock.ElapsedMilliseconds;
          }
          Console.Out.Flush(); Thread.Sleep(5);
        }
      } catch (System.IO.IOException) { /* Parent pipe closed. */ }
      finally { UnhookWindowsHookEx(hook); GC.KeepAlive(callback); }
    }
  }
}
