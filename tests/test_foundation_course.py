import copy
import json
from pathlib import Path
import re
import unittest
from urllib.parse import urlsplit

import jsonschema


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
    def _labeled_div(self, source, label_prefix):
        match = re.search(
            rf'<div[^>]*data-label="{re.escape(label_prefix)}[^"]*"[^>]*>.*?</div>',
            source,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(match, f"missing labeled block: {label_prefix}")
        return match.group(0)

    def _section(self, source, section_id):
        match = re.search(
            rf'<section id="{re.escape(section_id)}"[^>]*>.*?</section>',
            source,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(match, f"missing section: {section_id}")
        return match.group(0)

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

    def test_high_drift_units_have_specific_risk_and_source_coverage(self):
        catalog = json.loads((REPO / "src/modules-v1.json").read_text(encoding="utf-8"))
        units = {unit["id"]: unit for unit in catalog["units"]}
        expected_risks = {
            "CDX-M-0001": "medium",
            "CDX-M-0003": "high",
            "CDX-M-0005": "medium",
            "CDX-M-0006": "medium",
            "CDX-M-0007": "medium",
            "CDX-M-0008": "high",
            "CDX-M-0009": "high",
            "CDX-M-0010": "high",
            "CDX-M-0021": "high",
            "CDX-M-0024": "high",
            "CDX-M-0028": "high",
            "CDX-M-0030": "high",
        }
        for unit_id, risk in expected_risks.items():
            self.assertEqual(units[unit_id]["risk"], risk, unit_id)
        required_sources = {
            "CDX-M-0011": {
                "https://learn.chatgpt.com/docs/quickstart",
                "https://learn.chatgpt.com/docs/auth",
            },
            "CDX-M-0003": {
                "https://learn.chatgpt.com/docs/permission-modes",
                "https://learn.chatgpt.com/docs/computer-use",
            },
            "CDX-M-0007": {
                "https://learn.chatgpt.com/docs/artifacts-viewer",
                "https://learn.chatgpt.com/docs/plugins",
                "https://learn.chatgpt.com/docs/automations",
            },
            "CDX-M-0012": {
                "https://learn.chatgpt.com/docs/changelog",
                "https://learn.chatgpt.com/docs/cloud",
                "https://learn.chatgpt.com/docs/remote",
            },
            "CDX-M-0016": {
                "https://learn.chatgpt.com/docs/reference/settings",
                "https://learn.chatgpt.com/docs/code-review?surface=app",
                "https://learn.chatgpt.com/docs/environments/modes",
            },
            "CDX-M-0017": {
                "https://learn.chatgpt.com/docs/sandboxing",
                "https://learn.chatgpt.com/docs/agent-approvals-security",
            },
            "CDX-M-0021": {
                "https://learn.chatgpt.com/docs/environments/modes",
                "https://learn.chatgpt.com/docs/projects",
                "https://learn.chatgpt.com/docs/permission-modes",
            },
            "CDX-M-0028": {
                "https://learn.chatgpt.com/docs/sandboxing",
                "https://learn.chatgpt.com/docs/projects",
                "https://learn.chatgpt.com/docs/prompting",
            },
            "CDX-M-0029": {"https://learn.chatgpt.com/docs/prompting"},
            "CDX-M-0024": {"https://learn.chatgpt.com/docs/prompting"},
        }
        for unit_id, expected in required_sources.items():
            actual = {source["url"] for source in units[unit_id]["sourceRefs"]}
            self.assertTrue(expected <= actual, f"{unit_id}: missing {sorted(expected - actual)}")

    def test_public_and_maintainer_source_lists_cover_every_foundation_reference(self):
        catalog = json.loads((REPO / "src/modules-v1.json").read_text(encoding="utf-8"))
        urls = {
            source["url"]
            for unit in catalog["units"]
            if unit["id"] in FOUNDATION_IDS
            for source in unit["sourceRefs"]
        }
        public_sources = (REPO / "src/content/ch11.html").read_text(encoding="utf-8")
        maintainer_sources = (REPO / "src/research/sources.md").read_text(encoding="utf-8")
        listed_urls = {
            "ch11": set(re.findall(r'href="(https://[^"]+)"', public_sources)),
            "research": set(re.findall(r"https://[A-Za-z0-9./?=_-]+", maintainer_sources)),
        }
        for label, listed in listed_urls.items():
            missing = sorted(urls - listed)
            self.assertFalse(missing, f"{label}: missing source URLs {missing}")
        self.assertIn("最近复核：2026 年 9 月 4 日", public_sources)
        self.assertIn("最近复核：2026-09-04", maintainer_sources)

    def test_framework_keeps_public_github_and_both_lifecycle_states_explicit(self):
        source = json.loads((REPO / "src/maintainer/framework-v1.json").read_text(encoding="utf-8"))
        generated = json.loads((REPO / "registry/framework-v1.json").read_text(encoding="utf-8"))
        catalog = json.loads((REPO / "src/modules-v1.json").read_text(encoding="utf-8"))
        plan = (REPO / "src/maintainer/plans/2026-09-04-phase-c-foundations-plan.html").read_text(
            encoding="utf-8"
        )

        self.assertTrue(source["authority"]["canonicalSource"]["remoteRequired"])
        self.assertEqual(source["authority"]["github"]["phase"], "active-development")
        self.assertEqual(source["authority"]["github"]["visibility"], "public-only")
        self.assertEqual(generated["frameworkDefinitionStatus"], source["status"])
        self.assertEqual(generated["catalogStatus"], catalog["status"])
        self.assertEqual(generated["status"], catalog["status"])
        self.assertIn("Codex → New chat → Local", plan)
        self.assertNotIn("用 Quick chat 完成虚构练习", plan)

        schema = json.loads(
            (REPO / "src/maintainer/schemas/framework-v1.schema.json").read_text(encoding="utf-8")
        )
        for field in ("frameworkDefinitionStatus", "catalogStatus"):
            with self.subTest(required_field=field):
                invalid = copy.deepcopy(generated)
                invalid.pop(field)
                with self.assertRaises(jsonschema.ValidationError):
                    jsonschema.validate(instance=invalid, schema=schema)

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
        self.assertIn("确认当前产品是 Codex，再选择 New chat", chapter_four)
        self.assertIn("Local", chapter_four)
        self.assertNotIn("新建 Quick chat（快速对话）", chapter_four)
        self.assertIn("18 元", chapter_four)
        self.assertIn("28 元", chapter_four)
        self.assertIn("完整修订版", chapter_four)
        self.assertRegex(chapter_four, r"重新检查|从头复检|再次检查")

        chapter_five = (REPO / "src/content/ch05.html").read_text(encoding="utf-8")
        self.assertIn("Git 仓库", chapter_five)
        self.assertIn("Local", chapter_five)
        self.assertIn("Steer", chapter_five)
        self.assertIn("Queue", chapter_five)
        self.assertIn("/memories", chapter_five)
        self.assertRegex(chapter_five, r"新文件|新版本")
        self.assertNotIn("发现它正在读取错误文件，马上告诉它停止该方向", chapter_five)

    def test_chapter_five_exercises_are_consistent_and_executable(self):
        chapter_five = (REPO / "src/content/ch05.html").read_text(encoding="utf-8")
        complete_date = "2026 年 9 月 10 日至 2026 年 9 月 15 日"

        for label in (
            "原始材料：",
            "练习 3：",
            "练习 4：",
        ):
            with self.subTest(label=label):
                block = self._labeled_div(chapter_five, label)
                self.assertIn("蓝溪文具", block)
                self.assertIn(complete_date, block)

        handoff = self._labeled_div(chapter_five, "实际操作：填好交接卡并在新对话复现")
        for phrase in (
            "「Codex-练习」项目",
            "新建一条运行位置为 Local",
            "已填好的交接卡完整发送",
            "只读文件，不修改任何内容",
            "读取该文件，复述",
            "不要修改任何文件",
        ):
            self.assertIn(phrase, handoff)
        self.assertNotIn("〖", handoff)

        rollback = self._section(chapter_five, "s4")
        for phrase in (
            "尚未完成 Windows 与 macOS 跨平台实测",
            "先确定外部备份目录，再做三个同名预检",
            "下一个未使用的 vNN",
            "任何已经存在的文件都不得被覆盖",
            "项目归属",
            "Local 运行位置",
            "确认真的已停止",
            "拒绝尚未处理的审批",
        ):
            self.assertIn(phrase, rollback)

        memory_exercise = self._labeled_div(chapter_five, "练习 6：")
        self.assertIn("开启 / 保持开启 / 关闭 / 保持关闭", memory_exercise)
        self.assertIn("在当前「Codex-练习」对话中发送这条安全规则", memory_exercise)
        self.assertIn("本练习的关键规则：读取或修改文件前，先确认目标文件并保留原件", memory_exercise)
        self.assertIn("请只复述这条规则，不要修改文件", memory_exercise)
        self.assertIn("当前界面不可见", memory_exercise)
        self.assertIn("这是本练习的合法完成分支", memory_exercise)

        for label in ("练习 1：", "练习 2：", "练习 5：", "练习 6："):
            with self.subTest(static_exercise=label):
                block = self._labeled_div(chapter_five, label)
                self.assertIn("纸笔或系统记事本", block)

    def test_beginner_recovery_paths_keep_choices_and_diagnoses_separate(self):
        chapter_three = (REPO / "src/content/ch03.html").read_text(encoding="utf-8")
        project_and_environment = self._section(chapter_three, "s6")
        self.assertIn("判断一：这次对话要不要加入项目", project_and_environment)
        self.assertIn("判断二：这次 Codex 对话在哪里运行", project_and_environment)
        self.assertIn("先回答“是否加入项目”，再单独回答“这次 Codex 对话在哪里运行”", project_and_environment)
        self.assertIn("不会把“项目”和“运行位置”混成同一个选择", project_and_environment)

        sign_in = self._section(chapter_three, "s5")
        sign_in_text = re.sub(r"<[^>]+>", "", sign_in)
        self.assertRegex(
            sign_in_text,
            r"如果找不到，先读(?:后面的)?\s*3\.6\s*找到权限位置，再读\s*3\.7\s*了解边界，然后回到本步骤",
        )

        chapter_four = (REPO / "src/content/ch04.html").read_text(encoding="utf-8")
        diagnosis = self._section(chapter_four, "s5")
        self.assertRegex(diagnosis, r"一条请求可能同时缺(?:少)?多项")
        self.assertRegex(diagnosis, r"<th>主要缺项(?:（(?:含|及)原因）)?</th>")
        self.assertRegex(diagnosis, r"<th>(?:其他可能缺项|还可能缺少的其他字段)</th>")

    def test_foundation_exercises_require_recorded_or_observable_completion(self):
        chapter_one = (REPO / "src/content/ch01.html").read_text(encoding="utf-8")
        self.assertIn("本章练习怎么做", chapter_one)
        self.assertIn("动手练习：写一份安全、完整的求助描述", chapter_one)
        self.assertIn("八个模板字段都已填写", chapter_one)
        self.assertIn("只会口头说明、只复制空模板", chapter_one)
        self.assertIn("必须已经独立完成 1.5 的求助描述", chapter_one)

        chapter_two = (REPO / "src/content/ch02.html").read_text(encoding="utf-8")
        self.assertIn("纸笔或系统自带的记事本", chapter_two)
        self.assertLess(chapter_two.index("作答步骤："), chapter_two.index("参考答案与通过标准"))
        self.assertIn("已获准、有权处理的虚构练习副本", chapter_two)
        self.assertIn("用 1—2 句话解释 Codex 是什么", chapter_two)
        self.assertIn("只答对 A/B/C、没有完成两题三项说明，仍不算通过", chapter_two)

        chapter_three = (REPO / "src/content/ch03.html").read_text(encoding="utf-8")
        self.assertIn("创建并确认练习文件夹为空", chapter_three)
        self.assertIn("确认其中没有文件、子文件夹或真实业务资料", chapter_three)
        self.assertIn("确认内容不再追加", chapter_three)
        self.assertIn("后续章节为了简短统一写「Codex-练习」", chapter_three)

        chapter_four = (REPO / "src/content/ch04.html").read_text(encoding="utf-8")
        self.assertIn("故意错例只做纸面诊断", chapter_four)
        self.assertIn("分支 A：4.3 的真实回复有未通过项", chapter_four)
        self.assertIn("分支 B：4.3 的真实回复已经全部通过", chapter_four)
        self.assertIn("只写一条未发送的修正请求不算完成", chapter_four)
        self.assertIn("沿用第 3 章的实际名称", chapter_four)
        for step in ("中断当前活动轮次", "确认真的停住", "拒绝待审批", "检查已经发生的事"):
            self.assertIn(step, chapter_four)

        for chapter_id in ("ch01", "ch02", "ch04", "ch05"):
            source = (REPO / f"src/content/{chapter_id}.html").read_text(encoding="utf-8")
            self.assertRegex(source, r"纸笔.{0,30}(?:记事本|文本编辑)", chapter_id)

        chapter_five = (REPO / "src/content/ch05.html").read_text(encoding="utf-8")
        self.assertIn("继续使用同一个实际练习名", chapter_five)


if __name__ == "__main__":
    unittest.main()
