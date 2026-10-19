#!/usr/bin/env python3
"""Compatibility wrapper for the old local command; the distributed runtime uses Node.js."""
from pathlib import Path
import subprocess
import sys

args = sys.argv[1:]
# Old three-demo mode now maps to the default two-instance experience.
args = ['pair' if arg == 'all' else arg for arg in args]
raise SystemExit(subprocess.call(['node', str(Path(__file__).with_suffix('.mjs')), *args]))
