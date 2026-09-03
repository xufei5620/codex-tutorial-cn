import os
from pathlib import Path
import subprocess
import sys
import unittest


REPO = Path(__file__).resolve().parents[1]


class CheckBaselineTests(unittest.TestCase):
    def test_success_output_does_not_crash_in_a_gbk_non_tty_process(self):
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["PYTHONUTF8"] = "0"
        env["PYTHONIOENCODING"] = "cp936"
        result = subprocess.run(
            [sys.executable, "src/check.py"],
            cwd=REPO,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(
            result.returncode,
            0,
            result.stderr.decode("utf-8", errors="replace"),
        )


if __name__ == "__main__":
    unittest.main()
