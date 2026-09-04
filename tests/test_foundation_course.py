import json
from pathlib import Path
import re
import unittest
from urllib.parse import urlsplit


REPO = Path(__file__).resolve().parents[1]
FOUNDATION_CHAPTERS = {
    "ch01": 5,
    "ch02": 5,
    "ch03": 8,
    "ch04": 6,
    "ch05": 6,
}
FOUNDATION_IDS = {f"CDX-M-{number:04d}" for number in range(1, 31)}
OFFICIAL_HOSTS = {"learn.chatgpt.com", "help.openai.com", "openai.com", "status.openai.com"}


class FoundationCourseTests(unittest.TestCase):
    def test_phase_c_has_a_new_content_identity(self):
        config = json.loads((REPO / "src/chapters.json").read_text(encoding="utf-8"))
        catalog = json.loads((REPO / "src/modules-v1.json").read_text(encoding="utf-8"))
        self.assertEqual(config["site"]["version"], "0.4.0")
        self.assertEqual(config["site"]["date"], "2026-09-04")
        self.assertEqual(catalog["contentVersion"], "0.4.0")
        self.assertEqual(catalog["generatedDate"], "2026-09-04")
        self.assertEqual(catalog["status"], "review-in-progress")

    def test_first_five_chapters_are_editorially_reviewed_but_not_falsely_verified(self):
        config = json.loads((REPO / "src/chapters.json").read_text(encoding="utf-8"))
        catalog = json.loads((REPO / "src/modules-v1.json").read_text(encoding="utf-8"))
        for chapter_id in FOUNDATION_CHAPTERS:
            self.assertEqual(config["chapters"][chapter_id]["status"], "editorial-reviewed")
        units = {unit["id"]: unit for unit in catalog["units"] if unit["id"] in FOUNDATION_IDS}
        self.assertEqual(set(units), FOUNDATION_IDS)
        for unit_id, unit in units.items():
            self.assertEqual(unit["contentStatus"], "editorial-reviewed", unit_id)
            self.assertEqual(unit["verificationState"], "unverified", unit_id)
            self.assertIsNone(unit["verificationDate"], unit_id)
            self.assertEqual(unit["rights"], "owned", unit_id)
            self.assertEqual(unit["lastReviewedDate"], "2026-09-04", unit_id)
            self.assertTrue(unit["sourceRefs"], unit_id)
            for source in unit["sourceRefs"]:
                self.assertEqual(source["author"], "OpenAI", unit_id)
                self.assertIn(urlsplit(source["url"]).hostname, OFFICIAL_HOSTS, unit_id)
                self.assertEqual(source["reviewDate"], "2026-09-04", unit_id)
                self.assertIn(source["reviewConclusion"], {"approved", "approved-with-limitations"}, unit_id)

    def test_foundation_chapters_keep_stable_units_and_course_closures(self):
        for chapter_id, expected_count in FOUNDATION_CHAPTERS.items():
            source = (REPO / f"src/content/{chapter_id}.html").read_text(encoding="utf-8")
            ids = re.findall(r'data-unit-id="(CDX-M-[0-9]{4})"', source)
            self.assertEqual(len(ids), expected_count, chapter_id)
            self.assertEqual(len(ids), len(set(ids)), chapter_id)
            self.assertIn('<section class="summary" id="summary">', source, chapter_id)
            for marker in ("练习", "检查", "停止"):
                self.assertIn(marker, source, f"{chapter_id}: missing {marker}")
            self.assertRegex(source, r'https://(?:learn\.chatgpt\.com|help\.openai\.com|openai\.com)/')
            self.assertNotIn("【填写】", source)

    def test_dangerous_or_obsolete_absolute_promises_are_removed(self):
        combined = "\n".join(
            (REPO / f"src/content/{chapter_id}.html").read_text(encoding="utf-8")
            for chapter_id in FOUNDATION_CHAPTERS
        )
        forbidden = (
            "Codex 会在动手前弹出确认框",
            "停下来永远不会造成损失",
            "什么都不选",
            "只能读写这个文件夹里的东西，外面的碰不到",
            "熟练后再换成自己的真实材料",
            "手机 App 里用不了 Codex",
            "网页和手机上用不了",
        )
        for phrase in forbidden:
            self.assertNotIn(phrase, combined)

    def test_high_drift_product_claims_are_conditioned_and_exposed_as_unverified(self):
        chapter_three = (REPO / "src/content/ch03.html").read_text(encoding="utf-8")
        self.assertIn("Ask for approval", chapter_three)
        self.assertRegex(chapter_three, r"待实测|未实测|真实设备.*尚未完成|验证尚未完成")
        self.assertNotRegex(chapter_three, r"macOS 14.*最低|Intel.*也能安装|Windows 10/11.*一般")
        self.assertNotIn("地址以 openai.com 或 chatgpt.com 结尾", chapter_three)

    def test_first_request_and_revision_workflows_are_concrete(self):
        chapter_four = (REPO / "src/content/ch04.html").read_text(encoding="utf-8")
        self.assertIn("Quick chat", chapter_four)
        self.assertIn("18 元", chapter_four)
        self.assertIn("28 元", chapter_four)
        self.assertIn("完整修订版", chapter_four)
        self.assertRegex(chapter_four, r"重新检查|从头复检|再次检查")

        chapter_five = (REPO / "src/content/ch05.html").read_text(encoding="utf-8")
        self.assertIn("Git 仓库", chapter_five)
        self.assertIn("Steer", chapter_five)
        self.assertIn("Queue", chapter_five)
        self.assertIn("/memories", chapter_five)
        self.assertRegex(chapter_five, r"新文件|新版本")


if __name__ == "__main__":
    unittest.main()
