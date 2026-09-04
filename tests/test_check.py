import copy
import hashlib
import importlib.util
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
PNG_DOT = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
    b"\x0b\xe7\x02\x9d"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


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


def media_asset_record() -> dict[str, object]:
    return {
        "id": "IMG-C03-0001",
        "kind": "ui-screenshot",
        "path": "assets/media/course/ch03/codex-entry-windows.png",
        "mediaType": "image/png",
        "alt": "ChatGPT 桌面应用中选择 Codex 的实际界面",
        "caption": "Windows 示例：从 ChatGPT 产品入口选择 Codex。",
        "sourceType": "maintainer-capture",
        "sourceUrl": None,
        "license": "owned",
        "rights": "owned",
        "platform": "windows",
        "observedProductVersion": "ChatGPT desktop 2026-09-04",
        "verificationState": "unverified",
        "verificationDate": None,
        "lastReviewedDate": "2026-09-04",
    }


def install_media_fixture(root: Path, asset: dict[str, object] | None = None) -> dict[str, object]:
    asset = dict(media_asset_record() if asset is None else asset)
    relative = asset["path"].removeprefix("assets/media/")
    source = root / "src/media" / relative
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(PNG_DOT)
    catalog_path = root / "src/media-v1.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    catalog["assets"].append(asset)
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with (root / "src/content/ch03.html").open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(
            "\n"
            "<figure>\n"
            f'  <img src="{{{{media:{asset["id"]}}}}}" alt="{asset["alt"]}">\n'
            f"  <figcaption>{asset['caption']}</figcaption>\n"
            "</figure>\n"
        )
    return asset


class CheckBaselineTests(unittest.TestCase):
    def test_strict_check_accepts_registered_generated_media(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            shutil.rmtree(root / ".superpowers", ignore_errors=True)
            install_media_fixture(root)
            build = run_build(root)
            self.assertEqual(build.returncode, 0, build.stderr.decode("utf-8", errors="replace"))

            result = run_check(root, "--strict", "--verify-generated")

            self.assertEqual(
                result.returncode,
                0,
                result.stdout.decode("utf-8", errors="replace"),
            )

    def test_strict_check_rejects_unregistered_generated_media_references(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            shutil.rmtree(root / ".superpowers", ignore_errors=True)
            install_media_fixture(root)
            build = run_build(root)
            self.assertEqual(build.returncode, 0, build.stderr.decode("utf-8", errors="replace"))
            rogue = root / "assets/media/rogue.png"
            rogue.parent.mkdir(parents=True, exist_ok=True)
            rogue.write_bytes(PNG_DOT)
            with (root / "ch01.html").open("a", encoding="utf-8", newline="\n") as handle:
                handle.write('\n<img src="assets/media/rogue.png" alt="rogue">\n')

            catalog = json.loads((root / "src/media-v1.json").read_text(encoding="utf-8"))
            errors, warnings = checker.check_media_references(root, catalog, strict=True)

            self.assertEqual(warnings, [])
            self.assertTrue(
                any("unregistered media" in error for error in errors),
                errors,
            )

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

    def test_check_rejects_wrong_online_manifest_identity(self):
        import json

        wrong_values = {
            "schemaVersion": "9.9.9",
            "artifact": "wrong-artifact",
            "entry": "missing.html",
        }
        for field, wrong_value in wrong_values.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "repo"
                copy_repo(root)
                path = root / "manifest.json"
                manifest = json.loads(path.read_text(encoding="utf-8"))
                manifest[field] = wrong_value
                path.write_text(
                    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                    newline="\n",
                )
                result = run_check(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"online manifest {field}".encode(), result.stdout)

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

    def test_check_rejects_an_unknown_publishable_root_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "unlisted-public.txt").write_text(
                "would be copied by the deployment image\n",
                encoding="utf-8",
                newline="\n",
            )
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"unknown publishable root entry", result.stdout.lower())
            self.assertIn(b"unlisted-public.txt", result.stdout)

    def test_repository_safety_rejects_unexpected_private_artifacts(self):
        for relative in (
            "src/private.env",
            "tests/private.txt",
            "src/maintainer/private-note.txt",
            "src/content/untracked-secret.exe",
            ".venv/secret.env",
            "src/__pycache__/secret.env",
        ):
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "repo"
                copy_repo(root)
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("placeholder secret material\n", encoding="utf-8", newline="\n")
                result = run_check(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(relative.replace("/", "\\").encode(), result.stdout.replace(b"/", b"\\"))

    def test_repository_safety_ignores_runtime_bytecode_without_git_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            cache = root / "src/__pycache__/check.cpython-314.pyc"
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(b"runtime cache")
            result = run_check(root)
            self.assertEqual(result.returncode, 0, result.stdout.decode("utf-8", errors="replace"))

    def test_check_rejects_an_unknown_publishable_root_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "unlisted-public-dir").mkdir()
            (root / "unlisted-public-dir/note.txt").write_text(
                "would be copied by the deployment image\n",
                encoding="utf-8",
                newline="\n",
            )
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"unknown publishable root entry", result.stdout.lower())
            self.assertIn(b"unlisted-public-dir", result.stdout)

    def test_check_rejects_an_unknown_download_file_without_generated_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "downloads/unlisted-public.zip").write_bytes(b"not a release")
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"unexpected download artifact", result.stdout.lower())
            self.assertIn(b"unlisted-public.zip", result.stdout)

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

    def test_check_rejects_non_reproducible_zip_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            archive = next((root / "downloads").glob("*-offline.zip"))
            replacement = archive.with_name("replacement.zip")
            with zipfile.ZipFile(archive) as source, zipfile.ZipFile(replacement, "w") as target:
                for index, info in enumerate(source.infolist()):
                    copied = copy.copy(info)
                    if index == 0:
                        copied.external_attr = 0o100 << 16
                    target.writestr(copied, source.read(info.filename))
            replacement.replace(archive)
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            archive.with_name(archive.name + ".sha256").write_text(
                f"{digest}  {archive.name}\n",
                encoding="ascii",
                newline="\n",
            )
            result = run_check(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"ZIP member mode is not reproducible 0644", result.stdout)

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
            "style block": "<style>@import 'https://example.invalid/remote.css';</style>",
            "remote base": "<base href='https://example.invalid/'>",
            "SVG image": "<svg><image href='https://example.invalid/pixel.png'></image></svg>",
            "iframe srcdoc": "<iframe srcdoc='&lt;script&gt;alert(1)&lt;/script&gt;'></iframe>",
            "iframe data URL": "<iframe src='data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;'></iframe>",
            "meta refresh": (
                "<meta http-equiv='refresh' content='0; url=https://example.invalid/redirect'>"
            ),
            "unclosed style": "<style>@import 'https://example.invalid/remote.css';",
            "legacy background": "<body background='https://example.invalid/pixel.png'></body>",
            "unknown URL attribute": "<div mystery='https://example.invalid/pixel.png'></div>",
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

    def test_html_safety_check_rejects_duplicate_attribute_names(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<!doctype html><html><body><section id="wrong" id="right"><h1>x</h1></section></body></html>\n',
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertTrue(any("duplicate attribute" in error for error in errors), errors)

    def test_svg_asset_safety_check_rejects_remote_runtime_resources(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "assets/remote.svg").write_text(
                "<svg xmlns='http://www.w3.org/2000/svg'>"
                "<image href='https://example.invalid/pixel.png'></image></svg>\n",
                encoding="utf-8",
                newline="\n",
            )
            (root / "index.html").write_text(
                "<!doctype html><html><body><img src='assets/remote.svg'></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertTrue(any("remote" in error for error in errors), errors)

    def test_svg_asset_safety_check_rejects_xml_stylesheets(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "assets/remote.svg").write_text(
                "<?xml version='1.0'?>\n"
                "<?xml-stylesheet href='https://example.invalid/remote.css'?>\n"
                "<svg xmlns='http://www.w3.org/2000/svg'></svg>\n",
                encoding="utf-8",
                newline="\n",
            )
            (root / "index.html").write_text(
                "<!doctype html><html><body><img src='assets/remote.svg'></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertTrue(any("xml-stylesheet" in error for error in errors), errors)

    def test_html_like_htm_files_are_audited_even_when_loaded_locally(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "payload.htm").write_text(
                "<!doctype html><html><body><script>alert(1)</script></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            (root / "index.html").write_text(
                "<!doctype html><html><body><iframe src='payload.htm'></iframe></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, page_count, _ = checker.check_site_tree(root)
            self.assertEqual(page_count, 2)
            self.assertTrue(any("iframe" in error or "script" in error for error in errors), errors)

    def test_html_safety_check_allows_an_embedded_image_data_url(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                "<!doctype html><html><body>"
                "<img alt='dot' src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yw='>"
                "</body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertFalse(errors, errors)

    def test_link_check_rejects_missing_local_runtime_resources(self):
        checker = load_check_module()
        cases = {
            "src": "<img src='definitely-missing.png'>",
            "srcset": "<source srcset='missing-one.png 1x, missing-two.png 2x'>",
            "imagesrcset": "<link rel='preload' imagesrcset='missing-one.png 1x'>",
            "data": "<object data='missing-object.bin'></object>",
            "poster": "<video poster='missing-poster.png'></video>",
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
                self.assertTrue(any("broken local" in error for error in errors), errors)

    def test_offline_link_check_rejects_root_relative_runtime_resources(self):
        checker = load_check_module()
        cases = {
            "src": "<img src='/assets/favicon.svg'>",
            "srcset": "<source srcset='/assets/favicon.svg 1x'>",
        }
        for label, markup in cases.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "assets").mkdir()
                (root / "assets/favicon.svg").write_text("<svg></svg>\n", encoding="utf-8", newline="\n")
                (root / "index.html").write_text(
                    f"<!doctype html><html><body>{markup}</body></html>\n",
                    encoding="utf-8",
                    newline="\n",
                )
                errors, _, _ = checker.check_site_tree(root, allow_root_relative=False)
                self.assertTrue(any("root-relative" in error for error in errors), errors)

    def test_css_safety_check_rejects_remote_imports_and_urls(self):
        checker = load_check_module()
        cases = {
            "import": "@import 'https://example.invalid/remote.css';\n",
            "import without whitespace": "@import\"https://example.invalid/remote.css\";\n",
            "data import": "@import\"data:text/css,body%7Bcolor:red%7D\";\n",
            "url": ".x { background: url(//example.invalid/pixel.png); }\n",
            "image-set string": (
                '.x { background: image-set("https://example.invalid/pixel.png" 1x); }\n'
            ),
            "continued image-set string": (
                '.x { background: image-set("htt\\\nps://example.invalid/pixel.png" 1x); }\n'
            ),
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
                self.assertTrue(errors, errors)

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
            (root / "assets/favicon.svg").write_text("<svg></svg>\n", encoding="utf-8", newline="\n")
            (root / "index.html").write_text(
                "<!doctype html><html><body><p>safe</p></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertFalse(errors, errors)

    def test_css_safety_check_rejects_missing_local_urls_and_imports(self):
        checker = load_check_module()
        cases = {
            "url": '.x { background: url("missing.png"); }\n',
            "import": '@import "missing.css";\n',
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
                if label == "import":
                    self.assertTrue(any("@import" in error for error in errors), errors)
                else:
                    self.assertTrue(any("broken local" in error for error in errors), errors)

    def test_css_safety_check_rejects_unsupported_string_resource_loaders(self):
        checker = load_check_module()
        cases = {
            "image-set": '.x { background: image-set("missing.png" 1x); }\n',
            "image": '.x { background: image("missing.png"); }\n',
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
                self.assertTrue(any("unsupported CSS resource loader" in error for error in errors), errors)

    def test_link_check_accepts_case_insensitive_external_schemes(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                "<!doctype html><html><body><a href='HTTPS://example.com/docs'>docs</a></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertFalse(errors, errors)

    def test_external_navigation_rejects_non_public_or_credential_bearing_urls(self):
        checker = load_check_module()
        urls = (
            "http://example.com/docs",
            "https://127.1/docs",
            "https://2130706433/docs",
            "https://%6cocalhost/docs",
            "https://example.com/docs?access_token=secret",
        )
        for url in urls:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "index.html").write_text(
                    f"<!doctype html><html><body><a href='{url}'>docs</a></body></html>\n",
                    encoding="utf-8",
                    newline="\n",
                )
                errors, _, _ = checker.check_site_tree(root)
                self.assertTrue(any("external navigation URL" in error for error in errors), errors)

    def test_uppercase_css_and_svg_files_are_audited(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "index.html").write_text(
                "<!doctype html><html><body><p>safe</p></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            (root / "assets/unsafe.CSS").write_text(
                ".x { background: url('https://example.com/pixel.png'); }\n",
                encoding="utf-8",
                newline="\n",
            )
            (root / "assets/unsafe.SVG").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>\n',
                encoding="utf-8",
                newline="\n",
            )
            errors, _, _ = checker.check_site_tree(root)
            self.assertTrue(any("unsafe.CSS" in error for error in errors), errors)
            self.assertTrue(any("unsafe.SVG" in error for error in errors), errors)

    def test_binary_asset_extension_cannot_hide_plain_text(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "assets/fake.png").write_text(
                "not a PNG\n",
                encoding="utf-8",
                newline="\n",
            )
            errors = checker.check_public_text_safety(root, {"assets/fake.png"})
            self.assertTrue(any("does not match" in error for error in errors), errors)

    def test_strict_mode_fails_when_jsonschema_is_unavailable(self):
        result = run_check(REPO, "--strict", no_site_packages=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"jsonschema", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
