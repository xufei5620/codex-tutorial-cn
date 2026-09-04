import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
CATALOG_PATH = REPO / "src/media-v1.json"
PNG_DOT = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
    b"\x0b\xe7\x02\x9d"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)
SVG_DOT = (
    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\">"
    "<rect width=\"1\" height=\"1\" fill=\"#084a51\"/></svg>\n"
)
WEBP_DOT = b"RIFF\x00\x00\x00\x00WEBPVP8 "


def copy_repo(target: Path) -> None:
    shutil.copytree(
        REPO,
        target,
        ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", "preview.html"),
        dirs_exist_ok=True,
    )


def load_check_module(root: Path):
    spec = importlib.util.spec_from_file_location("course_check_media", root / "src/check.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def valid_screenshot() -> dict:
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
        "captureDate": "2026-09-04",
        "verificationState": "unverified",
        "verificationDate": None,
        "lastReviewedDate": "2026-09-04",
    }


def valid_prompt_effect() -> dict:
    return {
        "id": "IMG-PROMPT-EDUCATION-0001",
        "kind": "prompt-effect",
        "path": "assets/media/prompts/education/lesson-outline.webp",
        "mediaType": "image/webp",
        "alt": "教育行业课程大纲效果图示例",
        "caption": "教育行业 Prompt 效果图。",
        "sourceType": "generated-example",
        "sourceUrl": "https://openai.com/",
        "license": "owned",
        "rights": "owned",
        "industry": "education",
        "promptId": "PRM-COM-0006",
        "verificationState": "not-applicable",
        "verificationDate": None,
        "lastReviewedDate": "2026-09-04",
    }


def valid_owned_diagram() -> dict:
    return {
        "id": "IMG-C01-0001",
        "kind": "concept-diagram",
        "path": "assets/media/course/ch01/codex-safety-loop.svg",
        "mediaType": "image/svg+xml",
        "alt": "Codex 安全闭环示意图：描述、限定、执行、检查、纠正或停止。",
        "caption": "自有绘制示意图：Codex 安全闭环。",
        "sourceType": "owned-diagram",
        "sourceUrl": None,
        "license": "owned",
        "rights": "owned",
        "verificationState": "not-applicable",
        "verificationDate": None,
        "lastReviewedDate": "2026-09-04",
    }


def catalog_with(*assets: dict) -> dict:
    return {
        "contentVersion": "0.4.0",
        "generatedDate": "2026-09-04",
        "status": "draft",
        "assets": list(assets),
    }


def run_catalog_check(catalog: dict) -> tuple[list[str], list[str]]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / "repo"
        copy_repo(root)
        for asset in catalog.get("assets", []):
            if not isinstance(asset, dict):
                continue
            path = asset.get("path")
            if not isinstance(path, str) or not path.startswith("assets/media/"):
                continue
            source = root / "src/media" / path.removeprefix("assets/media/")
            source.parent.mkdir(parents=True, exist_ok=True)
            if path.endswith(".svg"):
                source.write_text(SVG_DOT, encoding="utf-8", newline="\n")
            elif path.endswith(".webp"):
                source.write_bytes(WEBP_DOT)
            else:
                source.write_bytes(PNG_DOT)
        catalog_path = root / "src/media-v1.json"
        catalog_path.write_text(
            json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        checker = load_check_module(root)
        check_media_catalog = getattr(checker, "check_media_catalog", None)
        if check_media_catalog is None:
            return ["media catalog checker is unavailable"], []
        return check_media_catalog(root, strict=True)


class MediaRegistryTests(unittest.TestCase):
    def assertRejected(self, catalog: dict, fragment: str) -> None:
        errors, _ = run_catalog_check(catalog)
        self.assertTrue(
            any(fragment in error for error in errors),
            f"expected an error containing {fragment!r}, got {errors!r}",
        )

    def test_source_catalog_uses_the_exact_top_level_interface(self):
        self.assertTrue(CATALOG_PATH.exists(), "source media catalog is missing")
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            set(catalog),
            {"contentVersion", "generatedDate", "status", "assets"},
        )
        self.assertTrue(
            {
                "IMG-C01-0001",
                "IMG-C02-0001",
                "IMG-C03-0001",
                "IMG-C04-0001",
                "IMG-C05-0001",
            }
            <= {asset["id"] for asset in catalog["assets"]}
        )
        errors, warnings = run_catalog_check(catalog)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_valid_assets_are_accepted(self):
        errors, warnings = run_catalog_check(catalog_with(valid_screenshot(), valid_prompt_effect()))
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_valid_owned_diagram_is_accepted(self):
        errors, warnings = run_catalog_check(catalog_with(valid_owned_diagram()))
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_duplicate_asset_ids_are_rejected(self):
        first = valid_screenshot()
        duplicate = valid_prompt_effect()
        duplicate["id"] = first["id"]
        self.assertRejected(catalog_with(first, duplicate), "duplicate asset IDs")

    def test_missing_alt_is_rejected(self):
        asset = valid_screenshot()
        del asset["alt"]
        self.assertRejected(catalog_with(asset), "alt")

    def test_missing_rights_is_rejected(self):
        asset = valid_screenshot()
        del asset["rights"]
        self.assertRejected(catalog_with(asset), "rights")

    def test_invalid_media_type_is_rejected(self):
        asset = valid_screenshot()
        asset["mediaType"] = "image/jpeg"
        self.assertRejected(catalog_with(asset), "mediaType")

    def test_media_type_must_match_path_suffix(self):
        png_asset = valid_prompt_effect()
        png_asset["path"] = "assets/media/prompts/education/lesson-outline.png"
        mutations = [
            (png_asset, "image/webp"),
            (valid_prompt_effect(), "image/svg+xml"),
            (valid_owned_diagram(), "image/png"),
        ]
        for asset, mismatched_media_type in mutations:
            with self.subTest(path=asset["path"], media_type=mismatched_media_type):
                asset["mediaType"] = mismatched_media_type
                self.assertRejected(catalog_with(asset), "does not match path suffix")

    def test_path_traversal_is_rejected(self):
        asset = valid_screenshot()
        asset["path"] = "../outside.svg"
        self.assertRejected(catalog_with(asset), "path traversal")

    def test_kind_specific_fields_are_required(self):
        mutations = [
            (valid_screenshot(), "platform"),
            (valid_screenshot(), "observedProductVersion"),
            (valid_prompt_effect(), "industry"),
            (valid_prompt_effect(), "promptId"),
        ]
        for asset, missing_field in mutations:
            with self.subTest(missing_field=missing_field):
                del asset[missing_field]
                self.assertRejected(catalog_with(asset), missing_field)

    def test_ui_screenshot_without_capture_date_is_rejected(self):
        asset = valid_screenshot()
        del asset["captureDate"]
        self.assertRejected(catalog_with(asset), "captureDate")

    def test_prompt_effect_with_unknown_prompt_id_is_rejected(self):
        asset = valid_prompt_effect()
        asset["promptId"] = "PRM-FAK-9999"
        self.assertRejected(catalog_with(asset), "unknown promptId")

    def test_source_url_with_credentials_is_rejected(self):
        asset = valid_screenshot()
        asset["sourceUrl"] = "https://user:secret@example.com/source"
        self.assertRejected(catalog_with(asset), "userinfo")

    def test_source_url_with_local_absolute_path_is_rejected(self):
        asset = valid_screenshot()
        asset["sourceUrl"] = r"C:\Users\example\capture.png"
        self.assertRejected(catalog_with(asset), "sourceUrl")


if __name__ == "__main__":
    unittest.main()
