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
TEXT_SUFFIXES = {
    ".conf",
    ".css",
    ".html",
    ".json",
    ".md",
    ".sha256",
    ".svg",
    ".txt",
    ".xml",
    ".yml",
    ".yaml",
}


def copy_repo(target: Path) -> None:
    shutil.copytree(
        REPO,
        target,
        ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", "preview.html"),
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
    def test_git_attributes_force_all_generated_text_types_to_lf(self):
        attributes = (REPO / ".gitattributes").read_text(encoding="utf-8")
        for pattern in ("*.conf", "*.svg", "*.sha256"):
            self.assertIn(f"{pattern} text eol=lf", attributes)

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

    def test_copied_conf_and_svg_sources_are_normalized_to_lf(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            nginx = root / "src/deploy/nginx.conf"
            nginx.write_bytes(nginx.read_bytes().replace(b"\n", b"\r\n"))
            fixture = root / "src/maintainer/templates/line-ending-fixture.svg"
            fixture.write_bytes(b'<svg xmlns="http://www.w3.org/2000/svg">\r\n</svg>\r\n')

            result = run_build(root)

            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            self.assertNotIn(b"\r\n", (root / "deploy/nginx.conf").read_bytes())
            self.assertNotIn(b"\r\n", (root / "templates/line-ending-fixture.svg").read_bytes())

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

    def test_online_manifest_contains_only_generated_public_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            paths = {item["path"] for item in manifest["files"]}
            forbidden = {
                path
                for path in paths
                if path.startswith(("src/", "tests/", ".github/"))
                or path in {"requirements-dev.txt", ".gitattributes", ".gitignore", ".dockerignore"}
                or "__pycache__" in path
            }
            self.assertEqual(forbidden, set())

    def test_public_copy_labels_every_current_lesson_as_an_unverified_draft_seed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            index = (root / "index.html").read_text(encoding="utf-8")
            readme = (root / "README.md").read_text(encoding="utf-8")
            chapter_eleven = (root / "ch11.html").read_text(encoding="utf-8")
            for public_copy in (index, readme):
                self.assertIn("草稿种子", public_copy)
                self.assertIn("不算完成课程", public_copy)
                self.assertIn("尚未逐条复核或实测", public_copy)
            self.assertNotIn("正文草稿已完成", index)
            self.assertNotIn("11 章全部有正文", readme)
            self.assertIn("可选在线预览", readme)
            self.assertIn("教程当前是 0.2.1 版", chapter_eleven)

            registry = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            config = json.loads((root / "src/chapters.json").read_text(encoding="utf-8"))
            self.assertEqual(registry["status"], "draft-seed-unverified")
            self.assertEqual(registry["releaseGate"]["currentDecision"], "course-beta-in-development")
            self.assertFalse(registry["currentSeedContent"]["final"])
            self.assertFalse(registry["currentSeedContent"]["countsAsCompletedCourseContent"])
            self.assertEqual(manifest["status"], "draft-seed-unverified")
            self.assertEqual({chapter["status"] for chapter in config["chapters"].values()}, {"draft"})

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

    def test_offline_zip_contains_only_reader_and_generated_maintainer_artifacts(self):
        archive = offline_archive(REPO)
        prefix = "codex-tutorial-cn/"
        with zipfile.ZipFile(archive) as package:
            paths = {
                name[len(prefix):]
                for name in package.namelist()
                if name.startswith(prefix) and not name.endswith("/")
            }
        forbidden = {
            path
            for path in paths
            if path.startswith(("src/", "tests/", ".github/", "deploy/"))
            or path in {"requirements-dev.txt", ".gitattributes", ".gitignore", ".dockerignore"}
            or "__pycache__" in path
        }
        self.assertEqual(forbidden, set())

    def test_offline_zip_excludes_online_only_routes(self):
        archive = offline_archive(REPO)
        prefix = "codex-tutorial-cn/"
        with zipfile.ZipFile(archive) as package:
            paths = {
                name[len(prefix):]
                for name in package.namelist()
                if name.startswith(prefix) and not name.endswith("/")
            }
        self.assertNotIn("404.html", paths)
        self.assertNotIn("robots.txt", paths)

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

    def test_offline_zip_uses_stored_entries_for_cross_platform_determinism(self):
        archive = offline_archive(REPO)
        with zipfile.ZipFile(archive) as package:
            compression_methods = {info.compress_type for info in package.infolist()}
        self.assertEqual(compression_methods, {zipfile.ZIP_STORED})

    def test_content_lifecycle_matches_the_formal_course_design(self):
        expected = [
            "outline",
            "draft",
            "source-and-rights-review",
            "editorial-reviewed",
            "verification",
            "acceptance-ready",
            "stable",
            "retired",
        ]
        registry = json.loads((REPO / "registry/framework-v1.json").read_text(encoding="utf-8"))
        schema = json.loads((REPO / "schemas/framework-v1.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(registry["contentStatus"]["pipeline"], expected)
        self.assertEqual(schema["$defs"]["pipelineState"]["enum"], expected)

    def test_quality_workflow_builds_before_diff_and_runs_on_main(self):
        workflow = (REPO / ".github/workflows/quality.yml").read_text(encoding="utf-8")
        self.assertRegex(workflow, r"(?m)^\s+- main\s*$")
        build_step = workflow.find("run: python src/build.py")
        diff_step = workflow.find("run: git diff --exit-code")
        self.assertGreaterEqual(build_step, 0)
        self.assertGreater(diff_step, build_step)


if __name__ == "__main__":
    unittest.main()
