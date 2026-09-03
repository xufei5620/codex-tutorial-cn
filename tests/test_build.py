import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


REPO = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".css", ".html", ".json", ".md", ".txt", ".xml", ".yml", ".yaml"}


def copy_repo(target: Path) -> None:
    shutil.copytree(
        REPO,
        target,
        ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc", "preview.html"),
        dirs_exist_ok=True,
    )


def run_build(root: Path) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONUTF8"] = "1"
    return subprocess.run(
        [sys.executable, "src/build.py"],
        cwd=root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def managed_tree(root: Path) -> dict[str, str]:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    paths = [item["path"] for item in manifest["files"]]
    downloads = sorted((root / "downloads").glob("*"))
    paths.extend(str(path.relative_to(root)).replace("\\", "/") for path in downloads)
    result = {}
    for relative in sorted(set(paths)):
        payload = (root / relative).read_bytes()
        result[relative] = hashlib.sha256(payload).hexdigest()
    return result


def offline_archive(root: Path) -> Path:
    config = json.loads((root / "src/chapters.json").read_text(encoding="utf-8"))
    return root / "downloads" / f"codex-tutorial-cn-v{config['site']['version']}-offline.zip"


def checksum_records(payload: str) -> dict[str, str]:
    records = {}
    for line in payload.splitlines():
        digest, relative = line.split("  ", 1)
        records[relative] = digest
    return records


class BuildBaselineTests(unittest.TestCase):
    def test_generated_text_is_utf8_lf_on_windows_and_linux(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            for item in manifest["files"]:
                path = root / item["path"]
                if path.suffix.lower() in TEXT_SUFFIXES or path.name in {"Caddyfile", "Dockerfile"}:
                    self.assertNotIn(b"\r\n", path.read_bytes(), item["path"])

    def test_two_consecutive_builds_have_the_same_managed_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            first = run_build(root)
            self.assertEqual(first.returncode, 0, first.stderr.decode("utf-8", errors="replace"))
            first_tree = managed_tree(root)
            second = run_build(root)
            self.assertEqual(second.returncode, 0, second.stderr.decode("utf-8", errors="replace"))
            self.assertEqual(managed_tree(root), first_tree)

    def test_generated_registry_separates_framework_content_and_artifact_versions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            registry = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
            config = json.loads((root / "src/chapters.json").read_text(encoding="utf-8"))
            self.assertEqual(registry["frameworkVersion"], "1.0.0")
            self.assertEqual(registry["contentVersion"], config["site"]["version"])
            self.assertEqual(registry["artifactVersion"], config["site"]["version"])
            self.assertNotIn("version", registry)

    def test_generated_readme_documents_the_real_double_brace_link_macro(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            readme = (root / "README.md").read_text(encoding="utf-8")
            self.assertIn("{{link:ch04}}", readme)
            self.assertIn("{{link:prompts#prm-com-0001}}", readme)

    def test_offline_manifest_declares_only_files_that_are_inside_the_zip(self):
        archive = offline_archive(REPO)
        prefix = "codex-tutorial-cn/"
        with zipfile.ZipFile(archive) as package:
            names = set(package.namelist())
            manifest = json.loads(package.read(prefix + "manifest.json").decode("utf-8"))
        missing = sorted(item["path"] for item in manifest["files"] if prefix + item["path"] not in names)
        self.assertEqual(missing, [], f"offline manifest names files absent from ZIP: {missing}")

    def test_offline_index_does_not_link_to_a_download_that_is_absent_from_the_zip(self):
        archive = offline_archive(REPO)
        prefix = "codex-tutorial-cn/"
        with zipfile.ZipFile(archive) as package:
            index = package.read(prefix + "index.html").decode("utf-8")
        self.assertNotIn('href="downloads/', index)
        self.assertIn("当前已是离线版", index)

    def test_offline_manifest_and_checksums_exactly_match_the_archive_payload(self):
        archive = offline_archive(REPO)
        prefix = "codex-tutorial-cn/"
        with zipfile.ZipFile(archive) as package:
            relative_files = {
                name[len(prefix):]
                for name in package.namelist()
                if name.startswith(prefix) and not name.endswith("/")
            }
            manifest = json.loads(package.read(prefix + "manifest.json").decode("utf-8"))
            sums = checksum_records(package.read(prefix + "SHA256SUMS.txt").decode("utf-8"))
            payload_paths = relative_files - {"manifest.json", "SHA256SUMS.txt"}
            self.assertEqual({item["path"] for item in manifest["files"]}, payload_paths)
            self.assertEqual(set(sums), payload_paths)
            for item in manifest["files"]:
                payload = package.read(prefix + item["path"])
                digest = hashlib.sha256(payload).hexdigest()
                self.assertEqual(item["size"], len(payload), item["path"])
                self.assertEqual(item["sha256"], digest, item["path"])
                self.assertEqual(sums[item["path"]], digest, item["path"])

    def test_offline_zip_has_a_matching_external_sha256_file(self):
        archive = offline_archive(REPO)
        checksum_file = archive.with_name(archive.name + ".sha256")
        self.assertTrue(checksum_file.is_file(), checksum_file)
        digest, name = checksum_file.read_text(encoding="ascii").strip().split("  ", 1)
        self.assertEqual(name, archive.name)
        self.assertEqual(digest, hashlib.sha256(archive.read_bytes()).hexdigest())

    def test_offline_zip_paths_are_relative_and_cannot_escape_the_package_root(self):
        archive = offline_archive(REPO)
        with zipfile.ZipFile(archive) as package:
            for name in package.namelist():
                normalized = name.replace("\\", "/")
                self.assertFalse(normalized.startswith("/"), normalized)
                self.assertNotIn("../", normalized, normalized)
                self.assertNotRegex(normalized, r"^[A-Za-z]:", normalized)


if __name__ == "__main__":
    unittest.main()
