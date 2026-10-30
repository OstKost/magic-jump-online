"""Compatibility entrypoint for the current local and online journey smoke suite."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('qa_modes.py')),run_name='__main__')
