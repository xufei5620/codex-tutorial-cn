import html
from html.parser import HTMLParser
import hashlib
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

    def test_phase_b_uses_a_new_artifact_identity(self):
        config = json.loads((REPO / "src/chapters.json").read_text(encoding="utf-8"))
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(config["site"]["version"], "0.3.0")
        self.assertEqual(config["site"]["date"], "2026-09-03")
        self.assertEqual(catalog["contentVersion"], "0.3.0")
        self.assertEqual(catalog["generatedDate"], "2026-09-03")
        chapter_eleven = (REPO / "src/content/ch11.html").read_text(encoding="utf-8")
        self.assertIn("教程当前是 0.3.0 版", chapter_eleven)
        self.assertIn("<td>0.3.0</td><td>2026-09-03</td>", chapter_eleven)

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
        self.assertEqual(catalog["verificationRecords"], [])

    def test_catalog_schema_validates_dates_paths_and_kind_specific_fields(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        errors = sorted(validator.iter_errors(catalog), key=lambda error: list(error.path))
        self.assertEqual(errors, [], [error.message for error in errors])
        framework = json.loads((REPO / "src/maintainer/framework-v1.json").read_text(encoding="utf-8"))
        self.assertEqual(
            schema["$defs"]["sourceRef"]["required"],
            framework["sourceRights"]["rules"]["thirdPartyRecordFields"],
        )

    def test_schema_version_is_fixed_to_the_supported_v1_contract(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        catalog["schemaVersion"] = "999.0.0"
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        self.assertTrue(list(validator.iter_errors(catalog)))

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
            {
                "author": "Example",
                "url": "http://example.invalid/source",
                "license": "link-only",
                "pinnedVersion": "accessed-2026-09-01",
                "reviewDate": "2026-09-01",
                "reviewConclusion": "approved",
                "use": "fact-reference",
            }
        ]
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        self.assertTrue(list(validator.iter_errors(changed)))

        changed = json.loads(json.dumps(catalog))
        changed["units"][0]["contentStatus"] = "editorial-reviewed"
        self.assertTrue(list(validator.iter_errors(changed)))

    def test_schema_requires_verified_cleared_evidence_before_stable(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        for status in ("acceptance-ready", "stable", "retired"):
            with self.subTest(top_status=status):
                changed = json.loads(json.dumps(catalog))
                changed["status"] = status
                self.assertTrue(list(validator.iter_errors(changed)))
        catalog["status"] = "review-in-progress"
        unit = catalog["units"][0]
        unit["contentStatus"] = "stable"
        unit["lastReviewedDate"] = "2026-09-03"
        self.assertTrue(list(validator.iter_errors(catalog)))

        unit["verificationState"] = "verified"
        unit["verificationDate"] = "2026-09-03"
        unit["rights"] = "owned"
        errors = list(validator.iter_errors(catalog))
        self.assertEqual(errors, [], [error.message for error in errors])

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

    def test_permanent_identity_allocation_is_locked_independently_of_html(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        lessons = [unit for unit in catalog["units"] if unit["kind"] == "lesson-module"]
        expected = []
        sequence = 1
        for chapter, count in LESSON_COUNTS.items():
            for order in range(1, count + 1):
                expected.append(
                    (
                        f"CDX-M-{sequence:04d}",
                        chapter,
                        order,
                        f"s{order}",
                        f"{chapter}.html#s{order}",
                    )
                )
                sequence += 1
        actual = [
            (unit["id"], unit["chapterId"], unit["order"], unit["sourceAnchor"], unit["publicPath"])
            for unit in lessons
        ]
        self.assertEqual(actual, expected)
        expected_legacy = [
            (f"CDX-M-{number:02d}01", chapter, f"{chapter}.html")
            for number, chapter in enumerate(LESSON_COUNTS, 1)
        ]
        actual_legacy = [
            (item["legacyId"], item["chapterId"], item["publicPath"])
            for item in catalog["legacyChapterPlaceholders"]
        ]
        self.assertEqual(actual_legacy, expected_legacy)

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
        prompt_source = (REPO / "src/content/prompts.html").read_text(encoding="utf-8")
        self.assertNotIn("进入 reviewed", prompt_source)
        self.assertIn("进入 editorial-reviewed", prompt_source)
        framework_schema = json.loads(
            (REPO / "src/maintainer/schemas/framework-v1.schema.json").read_text(encoding="utf-8")
        )
        self.assertEqual(framework_schema["$defs"]["chapter"]["properties"]["status"]["enum"], PIPELINE)
        artifact_statuses = framework_schema["properties"]["status"]["enum"]
        self.assertNotIn("reviewed", artifact_statuses)
        self.assertNotIn("platform-verified", artifact_statuses)

    def test_authoring_templates_use_the_catalog_identity_and_canonical_taxonomy(self):
        module_template = (REPO / "src/maintainer/templates/module-template.html").read_text(encoding="utf-8")
        self.assertIn("src/modules-v1.json", module_template)
        self.assertIn("data-unit-id", module_template)
        self.assertIn("contentStatus", module_template)
        self.assertIn("verificationState", module_template)
        prompt_template = (REPO / "src/maintainer/templates/prompt-card-template.html").read_text(encoding="utf-8")
        self.assertIn("src/modules-v1.json", prompt_template)
        for title in ("跨行业通用", "电商与零售", "餐饮与本地生活", "传媒与内容创作", "教育与培训"):
            self.assertIn(title, prompt_template)
        for title in ("沟通协作", "文档报告", "文件整理", "表格数据", "调研计划", "视觉创意"):
            self.assertIn(title, prompt_template)

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

    def test_prompt_math_tasks_risks_and_platform_exceptions_are_locked(self):
        catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        framework = json.loads((REPO / "src/maintainer/framework-v1.json").read_text(encoding="utf-8"))
        unique_cards = sum(item["uniqueCardCount"] for item in framework["promptLibrary"]["collections"])
        shared_placements = framework["promptLibrary"]["sharedCard"]["placementCount"] - 1
        self.assertEqual(unique_cards, 26)
        self.assertEqual(unique_cards + shared_placements, 30)
        self.assertEqual(
            framework["promptLibrary"]["sharedCard"]["placementCollections"],
            [item["key"] for item in catalog["collections"]],
        )
        prompts = [unit for unit in catalog["units"] if unit["kind"] == "prompt-card"]
        self.assertEqual([unit["taskKey"] for unit in prompts], [item["key"] for item in catalog["taskTypes"]])
        self.assertEqual({unit["risk"] for unit in prompts}, {"low"})
        single_platform = {
            unit["id"]: unit["platforms"]
            for unit in catalog["units"]
            if len(unit["platforms"]) == 1
        }
        self.assertEqual(single_platform, {"CDX-M-0013": ["windows"], "CDX-M-0014": ["macos"]})

    def test_public_text_safety_rejects_private_paths_outside_the_catalog(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "specs").mkdir()
            leak = root / "specs/leak.html"
            leak.write_text(
                "<!doctype html><html><body><p>K:/private/worktree/note</p></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors = checker.check_public_text_safety(root, {"specs/leak.html"})
            self.assertTrue(any("private path" in error for error in errors), errors)

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
                    "author": "OpenAI",
                    "url": "https://example.com/official-source",
                    "license": "link-only",
                    "pinnedVersion": "accessed-2026-09-01",
                    "reviewDate": "2026-09-01",
                    "reviewConclusion": "approved",
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

    def test_strict_checker_rejects_sensitive_or_local_source_urls(self):
        checker = load_check_module()
        urls = [
            "https://token@example.com/source",
            "https://localhost/source",
            "https://127.0.0.1/source",
            "https://10.0.0.1/source",
            "https://example.com/source?token=secret",
        ]
        for url in urls:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "repo"
                copy_repo(root)
                registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
                registry["units"][0]["sourceRefs"] = [
                    {
                        "author": "Example",
                        "url": url,
                        "license": "link-only",
                        "pinnedVersion": "accessed-2026-09-01",
                        "reviewDate": "2026-09-01",
                        "reviewConclusion": "approved",
                        "use": "fact-reference",
                    }
                ]
                (root / "registry/modules-v1.json").write_text(
                    json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                    newline="\n",
                )
                errors, _ = checker.check_module_registry(root, strict=True)
                self.assertTrue(any("source URL" in error for error in errors), errors)

    def test_strict_checker_rejects_unicode_escaped_private_paths(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            payload = (root / "registry/modules-v1.json").read_text(encoding="utf-8")
            payload = payload.replace('"title": "这套教程写给谁"', '"title": "\\u004b\\u003a\\u005cUsers\\u005calice"')
            (root / "registry/modules-v1.json").write_text(payload, encoding="utf-8", newline="\n")
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("private" in error or "drive path" in error for error in errors), errors)

    def test_strict_checker_rejects_catalog_status_drift(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["status"] = "stable"
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("status differs" in error or "schema error" in error for error in errors), errors)

    def test_malformed_catalog_returns_errors_instead_of_crashing(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "registry/modules-v1.json").write_text("[]\n", encoding="utf-8", newline="\n")
            errors, warnings = checker.check_module_registry(root, strict=True)
            self.assertEqual(warnings, [])
            self.assertTrue(errors)

    def test_strict_checker_rejects_data_unit_ids_on_other_public_pages(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            (root / "templates/ghost.html").write_text(
                '<!doctype html><html><body><section id="ghost" data-unit-id="AUDIT-GHOST-0001">'
                "<h2>幽灵单元</h2></section></body></html>\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("outside registered content pages" in error for error in errors), errors)

    def test_prompt_order_is_scoped_to_its_collection(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            future = dict(registry["units"][-1])
            future.update(
                {
                    "id": "PRM-ECM-0001",
                    "title": "未来电商卡片",
                    "collectionKeys": ["prompt-ecommerce"],
                    "taskKey": "communication",
                    "order": 1,
                    "sourceAnchor": "prm-ecm-0001",
                    "publicPath": "prompts.html#prm-ecm-0001",
                }
            )
            registry["units"].append(future)
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            source = (root / "prompts.html").read_text(encoding="utf-8")
            source = source.replace(
                '<section class="summary">',
                '<section class="prompt-card" id="prm-ecm-0001" data-unit-id="PRM-ECM-0001">'
                '<h2>卡片：未来电商卡片（PRM-ECM-0001） <span class="badge draft">草稿</span></h2>'
                "</section>\n<section class=\"summary\">",
            )
            (root / "prompts.html").write_text(source, encoding="utf-8", newline="\n")
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertEqual(errors, [])

    def test_strict_checker_rejects_legacy_mapping_changes(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            registry["legacyChapterPlaceholders"][0]["publicPath"] = "ch11.html"
            (root / "registry/modules-v1.json").write_text(
                json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("legacy chapter mapping differs" in error for error in errors), errors)

    def test_verification_records_enforce_risk_windows_and_catalog_dates(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            registry = json.loads((root / "registry/modules-v1.json").read_text(encoding="utf-8"))
            framework = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            registry["status"] = framework["status"] = manifest["status"] = "review-in-progress"
            unit = next(item for item in registry["units"] if item["id"] == "CDX-M-0013")
            unit.update(
                {
                    "contentStatus": "verification",
                    "verificationState": "verified",
                    "verificationDate": "2026-09-01",
                    "rights": "owned",
                    "lastReviewedDate": "2026-09-01",
                }
            )
            registry["verificationRecords"] = [
                {
                    "unitId": "CDX-M-0013",
                    "platform": "windows",
                    "browser": None,
                    "productVersion": "test-version",
                    "extensionVersion": None,
                    "inputClass": "synthetic-install-check",
                    "evidenceId": "EVD-CDX-M-0013-WINDOWS-001",
                    "result": "verified",
                    "checkedDate": "2026-09-01",
                    "expiresDate": "2026-10-02",
                    "verifiedBy": "device-owner",
                }
            ]
            for path, value in (
                (root / "registry/modules-v1.json", registry),
                (root / "registry/framework-v1.json", framework),
                (root / "manifest.json", manifest),
            ):
                path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            errors, _ = checker.check_module_registry(root, strict=True)
            self.assertTrue(any("risk window" in error for error in errors), errors)

    def test_offline_check_runs_module_semantics_inside_the_archive(self):
        checker = load_check_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            copy_repo(root)
            config = json.loads((root / "src/chapters.json").read_text(encoding="utf-8"))
            archive = next((root / "downloads").glob("*-offline.zip"))
            prefix = "codex-tutorial-cn/"
            with zipfile.ZipFile(archive) as package:
                infos = package.infolist()
                payloads = {info.filename: package.read(info.filename) for info in infos}
            target = prefix + "registry/modules-v1.json"
            payloads[target] = b"{}\n"
            manifest_name = prefix + "manifest.json"
            manifest = json.loads(payloads[manifest_name].decode("utf-8"))
            digest = hashlib.sha256(payloads[target]).hexdigest()
            record = next(item for item in manifest["files"] if item["path"] == "registry/modules-v1.json")
            record.update({"size": len(payloads[target]), "sha256": digest})
            payloads[manifest_name] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            sums_name = prefix + "SHA256SUMS.txt"
            sums = {}
            for line in payloads[sums_name].decode("utf-8").splitlines():
                checksum, relative = line.split("  ", 1)
                sums[relative] = checksum
            sums["registry/modules-v1.json"] = digest
            payloads[sums_name] = "".join(
                f"{checksum}  {relative}\n" for relative, checksum in sums.items()
            ).encode("utf-8")
            replacement = archive.with_name("replacement.zip")
            with zipfile.ZipFile(replacement, "w", zipfile.ZIP_STORED) as package:
                for info in infos:
                    package.writestr(info, payloads[info.filename])
            replacement.replace(archive)
            checksum_path = archive.with_name(archive.name + ".sha256")
            checksum_path.write_text(
                f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n",
                encoding="ascii",
                newline="\n",
            )
            errors = checker.check_offline_zip(root, config, strict=True)
            self.assertTrue(any("module catalog" in error for error in errors), errors)

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
