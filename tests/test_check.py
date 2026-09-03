import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


REPO = Path(__file__).resolve().parents[1]


def copy_repo(target: Path) -> None:
    shutil.copytree(
        REPO,
        target,
        ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", "preview.html"),
        dirs_exist_ok=True,
    )


def run_check(root: Path, *arguments: str, no_site_packages: bool = False) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONUTF8"] = "1"
    command = [sys.executable]
    if no_site_packages:
        command.append("-S")
    command.extend(["src/check.py", *arguments])
    return subprocess.run(
        command,
        cwd=root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


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

    def test_recursive_check_rejects_a_broken_link_in_a_nested_public_page(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "templates/nested-broken.html").write_text(
                '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>x</title></head>'
                '<body><main><h1>x</h1><a href="missing.html">missing</a></main></body></html>\n',
                encoding="utf-8",
                newline="\n",
            )
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"nested-broken.html", result.stdout)

    def test_check_rejects_a_root_manifest_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            with (root / "ch01.html").open("ab") as handle:
                handle.write(b"\n")
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"manifest", result.stdout.lower())

    def test_check_rejects_a_tampered_offline_zip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            archive = next((root / "downloads").glob("*-offline.zip"))
            replacement = archive.with_name("replacement.zip")
            with zipfile.ZipFile(archive) as source, zipfile.ZipFile(replacement, "w") as target:
                skipped = False
                for info in source.infolist():
                    if not skipped and info.filename.endswith("ch01.html"):
                        skipped = True
                        continue
                    target.writestr(info, source.read(info.filename))
            replacement.replace(archive)
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"offline", result.stdout.lower())

    def test_verify_generated_rejects_source_changes_that_were_not_built(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            with (root / "src/content/ch01.html").open("a", encoding="utf-8", newline="\n") as handle:
                handle.write("\n<!-- source drift -->\n")
            result = run_check(root, "--verify-generated")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"generated", result.stdout.lower())

    def test_strict_mode_fails_when_jsonschema_is_unavailable(self):
        result = run_check(REPO, "--strict", no_site_packages=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"jsonschema", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
