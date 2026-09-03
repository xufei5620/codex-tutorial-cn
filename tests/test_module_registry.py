import html
from html.parser import HTMLParser
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

import jsonschema


REPO = Path(__file__).resolve().parents[1]
LESSON_COUNTS = {
    "ch01": 5,
    "ch02": 5,
    "ch03": 8,
    "ch04": 6,
    "ch05": 6,
    "ch06": 6,
    "ch07": 6,
    "ch08": 8,
    "ch09": 5,
    "ch10": 5,
    "ch11": 5,
}
PROMPT_IDS = [f"PRM-COM-{number:04d}" for number in range(1, 7)]
PIPELINE = [
    "outline",
    "draft",
    "source-and-rights-review",
    "editorial-reviewed",
    "verification",
    "acceptance-ready",
    "stable",
    "retired",
]
VERIFICATION_STATES = [
    "verified",
    "verified-with-limitations",
    "verification-failed",
    "unverified",
    "unsupported",
    "verification-expired",
]


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


def load_check_module():
    spec = importlib.util.spec_from_file_location("course_check_modules", REPO / "src/check.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def normalize_heading(value: str) -> str:
    value = " ".join(html.unescape(value).split())
    value = re.sub(r"^\d+\.\d+\s*", "", value)
    value = re.sub(r"^卡片：", "", value)
    value = re.sub(r"（PRM-[A-Z]+-\d{4}）\s*草稿$", "", value)
    return value.strip()


class UnitParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.units = []
        self.summary_anchors = []
        self._current = None
        self._section_depth = 0
        self._heading_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attributes = {name.lower(): value or "" for name, value in attrs}
        if tag == "section":
            self._section_depth += 1
            if "summary" in attributes.get("class", "").split():
                self.summary_anchors.append(attributes.get("id"))
            unit_id = attributes.get("data-unit-id")
            if unit_id:
                self._current = {
                    "id": unit_id,
                    "anchor": attributes.get("id"),
                    "heading": [],
                    "depth": self._section_depth,
                }
        elif tag == "h2" and self._current is not None:
            self._heading_depth += 1

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h2" and self._heading_depth:
            self._heading_depth -= 1
        elif tag == "section":
            if self._current is not None and self._current["depth"] == self._section_depth:
                self._current["title"] = normalize_heading("".join(self._current.pop("heading")))
                self._current.pop("depth")
                self.units.append(self._current)
                self._current = None
            self._section_depth -= 1

    def handle_data(self, data):
        if self._current is not None and self._heading_depth:
            self._current["heading"].append(data)


def parse_units(path: Path) -> tuple[list[dict], list[str | None]]:
    parser = UnitParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser.units, parser.summary_anchors


class ModuleRegistryTests(unittest.TestCase):
    def setUp(self):
        self.catalog_path = REPO / "src/modules-v1.json"
        self.schema_path = REPO / "src/maintainer/schemas/modules-v1.schema.json"

    def test_source_catalog_has_65_lessons_and_6_existing_prompt_cards(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        lessons = [unit for unit in catalog["units"] if unit["kind"] == "lesson-module"]
        prompts = [unit for unit in catalog["units"] if unit["kind"] == "prompt-card"]
        self.assertEqual(len(lessons), 65)
        self.assertEqual(len(prompts), 6)
        self.assertEqual(len(catalog["units"]), 71)
        self.assertEqual([unit["id"] for unit in lessons], [f"CDX-M-{number:04d}" for number in range(1, 66)])
        self.assertEqual([unit["id"] for unit in prompts], PROMPT_IDS)

    def test_initial_catalog_preserves_draft_unverified_pending_state(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(catalog["contentPipeline"], PIPELINE)
        self.assertEqual(catalog["verificationStates"], VERIFICATION_STATES)
        for unit in catalog["units"]:
            self.assertEqual(unit["contentStatus"], "draft", unit["id"])
            self.assertEqual(unit["verificationState"], "unverified", unit["id"])
            self.assertIsNone(unit["verificationDate"], unit["id"])
            self.assertIsNone(unit["lastReviewedDate"], unit["id"])
            self.assertEqual(unit["rights"], "pending", unit["id"])
            self.assertEqual(unit["sourceRefs"], [], unit["id"])

    def test_catalog_schema_validates_dates_paths_and_kind_specific_fields(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        errors = sorted(validator.iter_errors(catalog), key=lambda error: list(error.path))
        self.assertEqual(errors, [], [error.message for error in errors])

    def test_schema_format_checker_rejects_an_impossible_date(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        catalog["units"][0]["verificationState"] = "verified"
        catalog["units"][0]["verificationDate"] = "2026-02-30"
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        self.assertTrue(list(validator.iter_errors(catalog)))

    def test_schema_allows_future_prompt_cards_without_a_phase_b_count_cap(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        future = dict(catalog["units"][-1])
        future.update(
            {
                "id": "PRM-ECM-0001",
                "title": "未来电商卡片",
                "collectionKeys": ["prompt-ecommerce"],
                "order": 1,
                "sourceAnchor": "prm-ecm-0001",
                "publicPath": "prompts.html#prm-ecm-0001",
            }
        )
        catalog["units"].append(future)
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        errors = list(validator.iter_errors(catalog))
        self.assertEqual(errors, [], [error.message for error in errors])

    def test_schema_rejects_invalid_states_platforms_rights_sources_and_review_dates(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        mutations = {
            "content status": ("contentStatus", "reviewed"),
            "verification state": ("verificationState", "passed"),
            "platform": ("platforms", ["linux"]),
            "risk": ("risk", "critical"),
            "rights": ("rights", "assumed"),
            "unsafe path": ("publicPath", "../private.html"),
        }
        for label, (field, value) in mutations.items():
            with self.subTest(label=label):
                changed = json.loads(json.dumps(catalog))
                changed["units"][0][field] = value
                validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
                self.assertTrue(list(validator.iter_errors(changed)))

        changed = json.loads(json.dumps(catalog))
        changed["units"][0]["sourceRefs"] = [
            {"url": "http://example.invalid/source", "accessedDate": "2026-09-01", "use": "fact-reference"}
        ]
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        self.assertTrue(list(validator.iter_errors(changed)))

        changed = json.loads(json.dumps(catalog))
        changed["units"][0]["contentStatus"] = "editorial-reviewed"
        self.assertTrue(list(validator.iter_errors(changed)))

    def test_lesson_units_match_every_numbered_source_section(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        records = {unit["id"]: unit for unit in catalog["units"] if unit["kind"] == "lesson-module"}
        seen = []
        for chapter, count in LESSON_COUNTS.items():
            units, summaries = parse_units(REPO / f"src/content/{chapter}.html")
            self.assertEqual(len(units), count, chapter)
            self.assertEqual(summaries, ["summary"], chapter)
            self.assertEqual([unit["anchor"] for unit in units], [f"s{number}" for number in range(1, count + 1)])
            for order, parsed in enumerate(units, 1):
                record = records[parsed["id"]]
                self.assertEqual(record["title"], parsed["title"])
                self.assertEqual(record["chapterId"], chapter)
                self.assertEqual(record["order"], order)
                self.assertEqual(record["sourceAnchor"], parsed["anchor"])
                self.assertEqual(record["publicPath"], f"{chapter}.html#{parsed['anchor']}")
                seen.append(parsed["id"])
        self.assertEqual(set(seen), set(records))
        self.assertEqual(len(seen), len(set(seen)))

    def test_prompt_units_match_the_six_existing_cards(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        records = {unit["id"]: unit for unit in catalog["units"] if unit["kind"] == "prompt-card"}
        units, _ = parse_units(REPO / "src/content/prompts.html")
        prompt_units = [unit for unit in units if unit["id"].startswith("PRM-")]
        self.assertEqual([unit["id"] for unit in prompt_units], PROMPT_IDS)
        for order, parsed in enumerate(prompt_units, 1):
            record = records[parsed["id"]]
            self.assertEqual(record["title"], parsed["title"])
            self.assertIsNone(record["chapterId"])
            self.assertEqual(record["collectionKeys"], ["prompt-common"])
            self.assertEqual(record["order"], order)
            self.assertEqual(record["sourceAnchor"], parsed["anchor"])
            self.assertEqual(record["publicPath"], f"prompts.html#{parsed['anchor']}")

    def test_legacy_chapter_ids_are_recorded_and_never_reused(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        legacy = catalog["legacyChapterPlaceholders"]
        self.assertEqual(len(legacy), 11)
        self.assertEqual([item["chapterId"] for item in legacy], list(LESSON_COUNTS))
        old_ids = {item["legacyId"] for item in legacy}
        new_ids = {unit["id"] for unit in catalog["units"]}
        self.assertFalse(old_ids & new_ids)

    def test_chapter_maintenance_blocks_label_old_ids_as_legacy(self):
        for number, chapter in enumerate(LESSON_COUNTS, 1):
            source = (REPO / f"src/content/{chapter}.html").read_text(encoding="utf-8")
            self.assertIn("章节聚合 ID / 状态", source, chapter)
            self.assertIn(f"CDX-C-{number:02d}", source, chapter)
            self.assertIn(f"旧占位 ID CDX-M-{number:02d}01", source, chapter)
            self.assertNotIn("<dt>模块 ID / 状态</dt>", source, chapter)

    def test_framework_authoring_chapters_match_the_real_chapter_source(self):
        chapters = json.loads((REPO / "src/chapters.json").read_text(encoding="utf-8"))
        framework = json.loads((REPO / "src/maintainer/framework-v1.json").read_text(encoding="utf-8"))
        expected = [
            {
                "number": chapters["chapters"][chapter]["num"],
                "title": chapters["chapters"][chapter]["title"],
                "status": chapters["chapters"][chapter]["status"],
            }
            for part in chapters["parts"]
            for chapter in part["chapters"]
        ]
        self.assertEqual(framework["chapters"], expected)

    def test_catalog_taxonomy_matches_the_framework_registry(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        framework = json.loads((REPO / "src/maintainer/framework-v1.json").read_text(encoding="utf-8"))
        expected_collections = [
            {"key": item["key"], "title": item["title"]}
            for item in framework["promptLibrary"]["collections"]
        ]
        self.assertEqual(catalog["collections"], expected_collections)
        self.assertEqual(
            [item["key"] for item in catalog["taskTypes"]],
            framework["promptLibrary"]["taskKeys"],
        )

    def test_maintenance_docs_use_the_eight_state_pipeline_and_module_catalog_truth(self):
        release = (REPO / "src/maintainer/maintenance-release.html").read_text(encoding="utf-8")
        positions = [release.find(f"<code>{state}</code>") for state in PIPELINE]
        self.assertEqual(positions, sorted(positions))
        self.assertTrue(all(position >= 0 for position in positions))
        self.assertNotIn("release-ready", release)
        notion = (REPO / "src/maintainer/notion-workflow.html").read_text(encoding="utf-8")
        self.assertIn("src/modules-v1.json", notion)
        self.assertIn("registry/modules-v1.json", notion)
        self.assertIn("单向可读投影", notion)

    def test_catalog_contains_no_private_or_unsafe_path(self):
        payload = self.catalog_path.read_text(encoding="utf-8")
        for forbidden in ("C:\\", "K:\\", "\\\\", "../", "file://", ".codex", ".superpowers"):
            self.assertNotIn(forbidden, payload)

    def test_build_publishes_catalog_and_schema_online_and_offline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            self.assertEqual((root / "registry/modules-v1.json").read_bytes(), (root / "src/modules-v1.json").read_bytes())
            self.assertEqual(
                (root / "schemas/modules-v1.schema.json").read_bytes(),
                (root / "src/maintainer/schemas/modules-v1.schema.json").read_bytes(),
            )
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            paths = {record["path"] for record in manifest["files"]}
            self.assertIn("registry/modules-v1.json", paths)
            self.assertIn("schemas/modules-v1.schema.json", paths)
            archive = next((root / "downloads").glob("*-offline.zip"))
            with zipfile.ZipFile(archive) as package:
                names = set(package.namelist())
            self.assertIn("codex-tutorial-cn/registry/modules-v1.json", names)
            self.assertIn("codex-tutorial-cn/schemas/modules-v1.schema.json", names)

    def test_prompt_plan_explains_26_unique_cards_and_30_placements_without_ambiguity(self):
        source = (REPO / "src/content/prompts.html").read_text(encoding="utf-8")
        self.assertIn("每个行业入口新增 5 张专属卡，另复用 1 张共享卡", source)
        self.assertIn("26 张唯一卡、30 个展示位", source)

    def test_strict_checker_accepts_the_complete_catalog(self):
        checker = load_check_module()
        errors, warnings = checker.check_module_registry(REPO, strict=True)
        self.assertEqual(warnings, [])
        self.assertEqual(errors, [])

    def test_strict_checker_rejects_a_catalog_record_missing_from_html_mapping(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["units"].pop()
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("unit ID set" in error for error in errors), errors)

    def test_strict_checker_rejects_duplicate_ids_and_paths(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            result = run_build(root)
            self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["units"][1]["id"] = registry["units"][0]["id"]
            registry["units"][1]["publicPath"] = registry["units"][0]["publicPath"]
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("duplicate unit IDs" in error for error in errors), errors)
            self.assertTrue(any("duplicate public paths" in error for error in errors), errors)

    def test_strict_checker_allows_a_valid_https_source_reference(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["units"][0]["sourceRefs"] = [
                {
                    "url": "https://example.com/official-source",
                    "accessedDate": "2026-09-01",
                    "use": "fact-reference",
                }
            ]
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertEqual(errors, [])

    def test_strict_checker_rejects_taxonomy_drift_from_the_framework(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["collections"][0]["title"] = "另一套分类名"
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("collection taxonomy differs" in error for error in errors), errors)

    def test_strict_checker_rejects_an_unregistered_numbered_lesson_section(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            source = (root / "ch01.html").read_text(encoding="utf-8")
            source = source.replace(
                '<section class="summary" id="summary">',
                '<section id="s99"><h2><span class="sn">1.99</span>未登记单元</h2></section>\n'
                '<section class="summary" id="summary">',
            )
            (root / "ch01.html").write_text(source, encoding="utf-8", newline="\n")
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("unregistered numbered section" in error for error in errors), errors)

    def test_strict_checker_rejects_an_unregistered_prompt_card(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            source = (root / "prompts.html").read_text(encoding="utf-8")
            source = source.replace(
                '<section class="summary">',
                '<section class="prompt-card" id="prm-ecm-9999"><h2>未登记提示词卡</h2></section>\n'
                '<section class="summary">',
            )
            (root / "prompts.html").write_text(source, encoding="utf-8", newline="\n")
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("unregistered prompt card" in error for error in errors), errors)


if __name__ == "__main__":
    unittest.main()
