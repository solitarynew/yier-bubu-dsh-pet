#!/usr/bin/env python3
"""Compatibility wrapper; new installs use the dependency-free Node.js server."""
from pathlib import Path
import subprocess
raise SystemExit(subprocess.call(['node', str(Path(__file__).with_suffix('.mjs'))]))
