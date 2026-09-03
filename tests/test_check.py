import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


REPO = Path(__file__).resolve().parents[1]


def load_check_module():
    spec = importlib.util.spec_from_file_location("course_check", REPO / "src/check.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


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

    def test_check_rejects_a_managed_file_omitted_from_the_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "templates/unlisted-private-note.txt").write_text(
                "must not bypass the public inventory\n",
                encoding="utf-8",
                newline="\n",
            )
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"manifest", result.stdout.lower())
            self.assertIn(b"unlisted-private-note.txt", result.stdout)

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

    def test_verify_generated_inventory_does_not_trust_each_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "templates/unlisted-private-note.txt").write_text(
                "not generated from source\n",
                encoding="utf-8",
                newline="\n",
            )
            result = run_check(root, "--verify-generated")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"generated file sets differ", result.stdout.lower())

    def test_offline_link_check_rejects_root_relative_urls(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "assets/style.css").write_text("body {}\n", encoding="utf-8", newline="\n")
            (root / "index.html").write_text(
                '<!doctype html><html><head><link rel="stylesheet" href="/assets/style.css"></head>'
                '<body><a href="/">home</a></body></html>\n',
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root, allow_root_relative=False)
            self.assertTrue(any("root-relative" in error for error in errors), errors)

    def test_html_safety_check_handles_all_attribute_quoting_and_srcset(self):
        checker = load_check_module()
        cases = {
            "single quote": "<img src='https://example.invalid/pixel.png'>",
            "unquoted": "<img src=https://example.invalid/pixel.png>",
            "srcset": "<source srcset='local.png 1x, https://example.invalid/remote.png 2x'>",
            "event handler": "<button onclick='alert(1)'>click</button>",
        }
        for label, markup in cases.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "index.html").write_text(
                    f"<!doctype html><html><body>{markup}</body></html>\n",
                    encoding="utf-8",
                    newline="\n",
                )
                errors, _, _ = checker.check_site_tree(root)
                self.assertTrue(errors, label)

    def test_css_safety_check_rejects_remote_imports_and_urls(self):
        checker = load_check_module()
        cases = {
            "import": "@import 'https://example.invalid/remote.css';\n",
            "url": ".x { background: url(//example.invalid/pixel.png); }\n",
        }
        for label, payload in cases.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "assets").mkdir()
                (root / "assets/style.css").write_text(payload, encoding="utf-8", newline="\n")
                (root / "index.html").write_text(
                    "<!doctype html><html><body><p>safe</p></body></html>\n",
                    encoding="utf-8",
                    newline="\n",
                )
                errors, _, _ = checker.check_site_tree(root)
                self.assertTrue(any("remote" in error for error in errors), errors)

    def test_css_safety_check_allows_local_urls(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "assets/style.css").write_text(
                '.x { background: url("favicon.svg"); }\n',
                encoding="utf-8",
                newline="\n",
            )
            (root / "index.html").write_text(
                "<!doctype html><html><body><p>safe</p></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertFalse(errors, errors)

    def test_strict_mode_fails_when_jsonschema_is_unavailable(self):
        result = run_check(REPO, "--strict", no_site_packages=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"jsonschema", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
