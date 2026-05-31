#!/usr/bin/env python3
"""Run supabase login with pseudo-TTY (browser flow for non-interactive agents)."""
import os
import pty
import select
import subprocess
import sys
import time

VERIFY_CODE = os.environ.get("SUPABASE_VERIFY_CODE") or (sys.argv[1] if len(sys.argv) > 1 else "")

env = os.environ.copy()
env["PATH"] = os.path.expanduser("~/.local/bin:") + env.get("PATH", "")

master, slave = pty.openpty()
proc = subprocess.Popen(
    ["supabase", "login"],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    env=env,
    close_fds=True,
)
os.close(slave)

buffer = b""
sent_enter = False
sent_code = False
deadline = time.time() + 300

while time.time() < deadline:
    if proc.poll() is not None:
        break

    ready, _, _ = select.select([master], [], [], 0.5)
    if not ready:
        continue

    chunk = os.read(master, 4096)
    if not chunk:
        break

    sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()
    buffer += chunk

    if not sent_enter and b"Press Enter" in buffer:
        time.sleep(0.3)
        os.write(master, b"\n")
        sent_enter = True

    if (
        not sent_code
        and VERIFY_CODE
        and b"verification code" in buffer.lower()
    ):
        time.sleep(0.3)
        os.write(master, (VERIFY_CODE + "\n").encode())
        sent_code = True

try:
    while proc.poll() is None:
        ready, _, _ = select.select([master], [], [], 0.5)
        if ready:
            chunk = os.read(master, 4096)
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
            else:
                break
        elif sent_code:
            break
except Exception:
    pass

exit_code = proc.wait(timeout=15)
sys.exit(exit_code)
