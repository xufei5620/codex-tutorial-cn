#!/usr/bin/env python3
"""Strict, non-mutating release checks for the generated tutorial artifacts."""

import argparse
from datetime import date
import hashlib
import html
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit
import zipfile


ROOT = Path(__file__).resolve().parent.parent
STATUS_ZH = {
    "outline": "大纲",
    "draft": "草稿",
    "source-and-rights-review": "来源与权利复核",
    "editorial-reviewed": "已编辑审校",
    "verification": "验证中",
    "acceptance-ready": "待验收",
    "stable": "稳定",
    "retired": "已退役",
}
EXCLUDED_PUBLIC_PARTS = {".git", ".github", ".venv", "src", "tests", "downloads", "__pycache__"}
URL_ATTRIBUTES = {
    "archive",
    "background",
    "cite",
    "code",
    "codebase",
    "data",
    "href",
    "icon",
    "imagesrcset",
    "longdesc",
    "manifest",
    "poster",
    "profile",
    "src",
    "srcset",
    "usemap",
    "xlink:href",
}
SRCSET_ATTRIBUTES = {"imagesrcset", "srcset"}
EXTERNAL_SCHEMES = ("http://", "https://", "mailto:", "tel:")
EMBEDDED_SCHEMES = ("data:",)
UNSAFE_SCHEMES = ("javascript:", "vbscript:")
EXTERNAL_NAVIGATION = {("a", "href")}
FORBIDDEN_ELEMENTS = {"applet", "base", "embed", "fencedframe", "frame", "frameset", "iframe", "object", "portal", "script"}
FORBIDDEN_ATTRIBUTES = {"action", "formaction", "ping", "srcdoc"}
DATA_URL_MEDIA = {
    ("audio", "src"),
    ("image", "href"),
    ("image", "xlink:href"),
    ("img", "src"),
    ("source", "src"),
    ("track", "src"),
    ("video", "src"),
}
MANAGED_ROOT_FILES = {
    "404.html",
    "README.md",
    "index.html",
    "maintenance-release.html",
    "notion-workflow.html",
    "robots.txt",
    "source-research.html",
}
MANAGED_ROOT_DIRECTORIES = {"assets", "deploy", "registry", "schemas", "specs", "templates"}
MANAGED_METADATA = {"manifest.json", "SHA256SUMS.txt"}
PUBLIC_TEXT_SUFFIXES = {".conf", ".css", ".html", ".htm", ".json", ".md", ".sha256", ".svg", ".txt", ".xml", ".xhtml", ".yml", ".yaml"}
PUBLIC_TEXT_NAMES = {"Caddyfile", "Dockerfile"}
DEVELOPER_ROOT_ENTRIES = {
    ".dockerignore",
    ".git",
    ".gitattributes",
    ".github",
    ".gitignore",
    ".venv",
    "__pycache__",
    "requirements-dev.txt",
    "src",
    "tests",
}
LOCKED_LESSON_COUNTS = {
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
LOCKED_CHAPTER_RISK = {
    "ch01": "low",
    "ch02": "low",
    "ch03": "high",
    "ch04": "low",
    "ch05": "medium",
    "ch06": "high",
    "ch07": "medium",
    "ch08": "medium",
    "ch09": "low",
    "ch10": "medium",
    "ch11": "medium",
}
LOCKED_PROMPT_TASKS = {
    "PRM-COM-0001": "communication",
    "PRM-COM-0002": "document-report",
    "PRM-COM-0003": "file-organization",
    "PRM-COM-0004": "table-data",
    "PRM-COM-0005": "research-plan",
    "PRM-COM-0006": "visual",
}


def is_remote_url(value: str) -> bool:
    return value.strip().lower().startswith(("http://", "https://", "//"))


def srcset_urls(value: str) -> list[str]:
    return [candidate.strip().split()[0] for candidate in value.split(",") if candidate.strip()]


def normalize_css(source: str) -> str:
    source = re.sub(r"\\(?:\r\n|[\n\r\f])", "", source)
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)

    def decode_escape(match: re.Match) -> str:
        if match.group(1):
            try:
                return chr(int(match.group(1), 16))
            except (ValueError, OverflowError):
                return ""
        return match.group(2) or ""

    return re.sub(r"\\(?:([0-9a-fA-F]{1,6})\s?|([^\r\n\f]))", decode_escape, source)


def css_urls(source: str) -> list[str]:
    source = normalize_css(source)
    values = []
    for match in re.finditer(
        r"url\(\s*(?:([\"'])(.*?)\1|([^\"')\s]+))\s*\)",
        source,
        flags=re.I | re.S,
    ):
        values.append(match.group(2) or match.group(3))
    return values


def contains_external_url(value: str) -> bool:
    return re.search(r"(?i)https?://|(?:^|[\s\"'(=,;])//|(?:mailto|tel):", value) is not None


def walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from walk_strings(key)
            yield from walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)


def private_path_label(value: str) -> str | None:
    checks = (
        (r"(?<![A-Za-z])[A-Za-z]:[\\/]", "drive path"),
        (r"(?:^|[^\\])\\\\[^\\\s]+[\\/]", "UNC path"),
        (r"(?i)file://", "file URL"),
        (r"(?i)(?:^|[\\/])\.(?:codex|superpowers)(?:[\\/]|$)", "private tool path"),
        (r"(?i)(?:^|[\\/])worktrees(?:[\\/]|$)", "private worktree path"),
        (r"/(?:Users|home)/[^/\s]+/", "private home path"),
    )
    for pattern, label in checks:
        if re.search(pattern, value):
            return label
    return None


def check_public_text_safety(root: Path, relative_paths: set[str]) -> list[str]:
    errors = []
    for relative in sorted(relative_paths):
        path = root.joinpath(*relative.split("/"))
        if not path.is_file() or (path.suffix.lower() not in PUBLIC_TEXT_SUFFIXES and path.name not in PUBLIC_TEXT_NAMES):
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"{relative}: declared text artifact is not UTF-8")
            continue
        values = [source, html.unescape(source)]
        if path.suffix.lower() == ".json":
            try:
                values = list(walk_strings(json.loads(source)))
            except json.JSONDecodeError:
                pass
        labels = sorted({label for value in values if (label := private_path_label(value))})
        for label in labels:
            errors.append(f"{relative}: private path detected ({label})")
    return errors


def source_url_problem(value: str) -> str | None:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return "cannot be parsed"
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        return "must use a public HTTPS host"
    if parsed.username is not None or parsed.password is not None:
        return "must not contain userinfo"
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        return "must not use a local hostname"
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved or address.is_unspecified:
            return "must not use a private or special IP address"
    sensitive_names = {"token", "key", "api_key", "apikey", "secret", "password", "auth", "signature", "credential"}
    for name, _ in parse_qsl(parsed.query, keep_blank_values=True):
        if name.lower() in sensitive_names:
            return f"must not contain sensitive query parameter {name!r}"
    if re.search(r"(?i)(?:token|secret|password|credential)=", parsed.fragment):
        return "must not contain sensitive fragment data"
    return None


class HTMLAuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[tuple[str, str, str]] = []
        self.embedded_styles: list[str] = []
        self._style_chunks: list[str] | None = None
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._audit_tag(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._audit_tag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "style" and self._style_chunks is not None:
            self.embedded_styles.append("".join(self._style_chunks))
            self._style_chunks = None

    def close(self) -> None:
        super().close()
        if self._style_chunks is not None:
            self.embedded_styles.append("".join(self._style_chunks))
            self.errors.append("contains unclosed style element")
            self._style_chunks = None

    def handle_data(self, data: str) -> None:
        if self._style_chunks is not None:
            self._style_chunks.append(data)

    def handle_pi(self, data: str) -> None:
        if re.match(r"(?i)\s*xml-stylesheet\b", data):
            self.errors.append("contains xml-stylesheet processing instruction")

    def _audit_tag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attribute_names = [raw_name.lower() for raw_name, _ in attrs]
        duplicate_attributes = repeated(attribute_names)
        if duplicate_attributes:
            self.errors.append(f"contains duplicate attribute names in {tag}: {duplicate_attributes}")
        attributes = {
            raw_name.lower(): html.unescape(raw_value or "").strip()
            for raw_name, raw_value in attrs
        }
        if tag in FORBIDDEN_ELEMENTS:
            self.errors.append(f"contains forbidden {tag} element")
        if tag == "style":
            self._style_chunks = []
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "refresh":
            self.errors.append("contains meta refresh")
        for raw_name, raw_value in attrs:
            name = raw_name.lower()
            value = html.unescape(raw_value or "").strip()
            if name == "id" and value:
                self.ids.append(value)
            if name in URL_ATTRIBUTES - SRCSET_ATTRIBUTES:
                self.references.append((tag, name, value))
            elif name in SRCSET_ATTRIBUTES:
                self.references.extend((tag, name, candidate) for candidate in srcset_urls(value))
            if name == "style":
                self.errors.append("contains inline style attribute")
            if name.startswith("on"):
                self.errors.append(f"contains inline event handler: {name}")
            if name in FORBIDDEN_ATTRIBUTES:
                self.errors.append(f"contains forbidden attribute {tag}[{name}]")
            if not name.startswith("xmlns") and contains_external_url(value):
                direct_external_navigation = (
                    (tag, name) in EXTERNAL_NAVIGATION
                    and (is_remote_url(value) or value.lower().startswith(("mailto:", "tel:")))
                )
                if not direct_external_navigation:
                    self.errors.append(f"external URL is not allowed in {tag}[{name}]")
            if name in URL_ATTRIBUTES:
                candidates = srcset_urls(value) if name in SRCSET_ATTRIBUTES else [value]
                for candidate in candidates:
                    lower = candidate.lower()
                    if lower.startswith(EMBEDDED_SCHEMES) and (tag, name) not in DATA_URL_MEDIA:
                        self.errors.append(f"data URL is not allowed in {tag}[{name}]")


def normalize_unit_heading(value: str) -> str:
    value = " ".join(html.unescape(value).split())
    value = re.sub(r"^\d+\.\d+\s*", "", value)
    value = re.sub(r"^卡片：", "", value)
    value = re.sub(r"（PRM-[A-Z]+-\d{4}）\s*草稿$", "", value)
    return value.strip()


class ContentUnitParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.units: list[dict] = []
        self.summary_anchors: list[str | None] = []
        self.unregistered_numbered_sections: list[str] = []
        self.unregistered_prompt_cards: list[str | None] = []
        self._sections: list[dict | None] = []
        self._capture_heading = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {name.lower(): value or "" for name, value in attrs}
        if tag == "section":
            if "summary" in attributes.get("class", "").split():
                self.summary_anchors.append(attributes.get("id"))
            unit_id = attributes.get("data-unit-id")
            anchor = attributes.get("id")
            classes = attributes.get("class", "").split()
            if re.fullmatch(r"s[1-9][0-9]*", anchor or "") and not unit_id:
                self.unregistered_numbered_sections.append(anchor)
            if "prompt-card" in classes and not unit_id:
                self.unregistered_prompt_cards.append(anchor)
            self._sections.append(
                {"id": unit_id, "anchor": anchor, "heading": []}
                if unit_id
                else None
            )
        elif tag == "h2" and self._sections and self._sections[-1] is not None:
            self._capture_heading = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "h2":
            self._capture_heading = False
        elif tag == "section" and self._sections:
            section = self._sections.pop()
            if section is not None:
                section["title"] = normalize_unit_heading("".join(section.pop("heading")))
                self.units.append(section)

    def handle_data(self, data: str) -> None:
        if self._capture_heading and self._sections and self._sections[-1] is not None:
            self._sections[-1]["heading"].append(data)


def parse_content_units(
    path: Path,
) -> tuple[list[dict], list[str | None], list[str], list[str | None]]:
    parser = ContentUnitParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return (
        parser.units,
        parser.summary_anchors,
        parser.unregistered_numbered_sections,
        parser.unregistered_prompt_cards,
    )


def configure_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(errors="backslashreplace")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def safe_relative(value: str) -> bool:
    normalized = value.replace("\\", "/")
    parts = normalized.split("/")
    return (
        bool(normalized)
        and not normalized.startswith("/")
        and not re.match(r"^[A-Za-z]:", normalized)
        and all(part not in ("", ".", "..") for part in parts)
    )


def checksum_records(payload: str) -> dict[str, str]:
    records = {}
    for line in payload.splitlines():
        if not line:
            continue
        try:
            digest, relative = line.split("  ", 1)
        except ValueError:
            raise ValueError(f"invalid checksum line: {line!r}") from None
        if relative in records:
            raise ValueError(f"duplicate checksum path: {relative}")
        records[relative] = digest
    return records


def public_html_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm", ".xhtml"}:
            continue
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def public_css_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.css"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def public_svg_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.svg"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def parse_html(path: Path) -> HTMLAuditParser:
    parser = HTMLAuditParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def check_site_tree(
    root: Path,
    chapter_config: dict | None = None,
    *,
    allow_root_relative: bool = True,
) -> tuple[list[str], int, int]:
    errors = []
    pages = public_html_files(root)
    parser_cache: dict[Path, HTMLAuditParser] = {}

    def audit_of(path: Path) -> HTMLAuditParser:
        if path not in parser_cache:
            parser_cache[path] = parse_html(path)
        return parser_cache[path]

    def validate_reference(
        source_path: Path,
        relative: str,
        reference: str,
        context: str,
        *,
        check_fragment: bool,
    ) -> bool:
        reference = html.unescape(reference).strip()
        lower = reference.lower()
        if not reference or is_remote_url(reference) or lower.startswith(EXTERNAL_SCHEMES + EMBEDDED_SCHEMES):
            return False
        if lower.startswith(UNSAFE_SCHEMES):
            errors.append(f"{relative}: unsafe URL scheme in {context}: {reference}")
            return False
        try:
            parsed = urlsplit(reference)
        except ValueError as error:
            errors.append(f"{relative}: invalid URL in {context}: {reference} ({error})")
            return False
        if parsed.scheme:
            errors.append(f"{relative}: unsupported URL scheme in {context}: {reference}")
            return False
        link_path = unquote(parsed.path)
        fragment = unquote(parsed.fragment)
        if not link_path:
            if not check_fragment or not fragment:
                return True
            target = source_path
        elif link_path.startswith("/"):
            if not allow_root_relative:
                errors.append(f"{relative}: root-relative reference is not portable offline in {context}: {reference}")
                return True
            if link_path == "/":
                target = root / "index.html"
            else:
                target = root / link_path.lstrip("/")
        else:
            target = source_path.parent / link_path
        try:
            resolved = target.resolve()
            resolved.relative_to(root.resolve())
        except ValueError:
            errors.append(f"{relative}: local reference escapes public root in {context}: {reference}")
            return True
        if resolved.is_dir():
            resolved = resolved / "index.html"
        if not resolved.is_file():
            errors.append(f"{relative}: broken local reference in {context}: {reference}")
            return True
        if (
            check_fragment
            and fragment
            and resolved.suffix.lower() in {".html", ".svg"}
            and fragment not in audit_of(resolved).ids
        ):
            errors.append(f"{relative}: missing anchor in {context}: {reference}")
        return True

    def validate_css_references(source_path: Path, relative: str, source: str, context: str) -> None:
        normalized = normalize_css(source)
        if re.search(r"(?i)@import\b", normalized):
            errors.append(f"{relative}: CSS @import is not allowed in {context}")
        if re.search(r"(?i)(?<![\w-])(?:-webkit-)?image(?:-set)?\s*\(", normalized):
            errors.append(f"{relative}: unsupported CSS resource loader in {context}")
        if contains_external_url(normalized):
            errors.append(f"{relative}: external URL is not allowed in {context}")
        for reference in css_urls(source):
            if is_remote_url(reference):
                errors.append(f"{relative}: remote {context} resource: {reference}")
                continue
            validate_reference(
                source_path,
                relative,
                reference,
                f"{context} resource",
                check_fragment=False,
            )

    def validate_audit_resources(path: Path, relative: str, audit: HTMLAuditParser) -> int:
        errors.extend(f"{relative}: {message}" for message in audit.errors)
        for embedded_style in audit.embedded_styles:
            validate_css_references(path, relative, embedded_style, "embedded CSS")
        checked_count = 0
        for tag, attribute, reference in audit.references:
            checked = validate_reference(
                path,
                relative,
                reference,
                f"{tag}[{attribute}]",
                check_fragment=attribute in {"href", "xlink:href"},
            )
            if checked:
                checked_count += 1
        return checked_count

    link_total = 0
    for path in pages:
        source = path.read_text(encoding="utf-8")
        relative = path.relative_to(root).as_posix()
        audit = audit_of(path)
        link_total += validate_audit_resources(path, relative, audit)

        ids = audit.ids
        duplicates = sorted({value for value in ids if ids.count(value) > 1})
        if duplicates:
            errors.append(f"{relative}: duplicate ids: {duplicates}")
        navigation = re.search(r'<nav class="section-nav".*?</nav>', source, re.S)
        if navigation:
            targets = re.findall(r'href="#([^"]+)"', navigation.group(0))
            sections = re.findall(
                r'<section\b(?![^>]*\bclass="[^"]*\bsummary\b)[^>]*\sid="([^"]+)"',
                source,
            )
            if targets != sections:
                errors.append(f"{relative}: section navigation does not match section ids")

        if chapter_config and path.parent == root:
            chapter_match = re.fullmatch(r"ch(\d{2})\.html", path.name)
            if chapter_match:
                chapter_id = f"ch{chapter_match.group(1)}"
                wanted = chapter_config["chapters"][chapter_id]["status"]
                badge = re.search(
                    r'<p class="kicker">第 \d+ 章 <span class="badge (\w+)">([^<]+)</span>',
                    source,
                )
                if not badge:
                    errors.append(f"{relative}: chapter badge missing")
                elif badge.group(1) != wanted or badge.group(2) != STATUS_ZH.get(wanted, wanted):
                    errors.append(f"{relative}: chapter badge differs from chapters.json")

    for path in public_svg_files(root):
        relative = path.relative_to(root).as_posix()
        link_total += validate_audit_resources(path, relative, audit_of(path))

    for path in public_css_files(root):
        relative = path.relative_to(root).as_posix()
        source = path.read_text(encoding="utf-8")
        validate_css_references(path, relative, source, "CSS")
    return errors, len(pages), link_total


def managed_public_paths(root: Path, chapter_config: dict) -> set[str]:
    paths = set(MANAGED_ROOT_FILES)
    paths.update(f"{chapter_id}.html" for chapter_id in chapter_config["chapters"])
    paths.update(f"{extra_id}.html" for extra_id in chapter_config["extras"])
    paths.update(
        path.name
        for path in root.glob("ch[0-9][0-9].html")
        if path.is_file()
    )
    for directory_name in MANAGED_ROOT_DIRECTORIES:
        directory = root / directory_name
        if not directory.is_dir():
            continue
        paths.update(
            path.relative_to(root).as_posix()
            for path in directory.rglob("*")
            if path.is_file()
        )
    return paths


def check_public_root_inventory(root: Path, managed_paths: set[str]) -> list[str]:
    allowed = {relative.split("/", 1)[0] for relative in managed_paths}
    allowed.update(MANAGED_METADATA)
    allowed.add("downloads")
    errors = []
    for path in sorted(root.iterdir(), key=lambda item: item.name):
        if path.name in allowed or path.name in DEVELOPER_ROOT_ENTRIES:
            continue
        kind = "directory" if path.is_dir() else "file"
        errors.append(f"unknown publishable root entry ({kind}): {path.name}")
    return errors


def expected_download_paths(chapter_config: dict) -> set[str]:
    version = chapter_config["site"]["version"]
    archive_name = f"codex-tutorial-cn-v{version}-offline.zip"
    return {f"downloads/{archive_name}", f"downloads/{archive_name}.sha256"}


def check_download_inventory(root: Path, chapter_config: dict) -> list[str]:
    expected = expected_download_paths(chapter_config)
    downloads = root / "downloads"
    actual = set()
    if downloads.is_dir():
        actual.update(
            path.relative_to(root).as_posix()
            for path in downloads.rglob("*")
            if path.is_file()
        )
    errors = []
    for relative in sorted(actual - expected):
        errors.append(f"unexpected download artifact: {relative}")
    for relative in sorted(expected - actual):
        errors.append(f"expected download artifact missing: {relative}")
    return errors


def check_manifest(root: Path, expected_paths: set[str]) -> list[str]:
    errors = []
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        sums = checksum_records((root / "SHA256SUMS.txt").read_text(encoding="utf-8"))
    except Exception as error:
        return [f"manifest/checksum cannot be read: {error}"]
    records = manifest.get("files")
    if not isinstance(records, list):
        return ["manifest files must be an array"]
    declared = []
    for record in records:
        relative = record.get("path") if isinstance(record, dict) else None
        if not isinstance(relative, str) or not safe_relative(relative):
            errors.append(f"manifest has unsafe path: {relative!r}")
            continue
        declared.append(relative)
        target = root.joinpath(*relative.split("/"))
        if not target.is_file():
            errors.append(f"manifest file missing: {relative}")
            continue
        payload = target.read_bytes()
        digest = sha256(payload)
        if record.get("size") != len(payload) or record.get("sha256") != digest:
            errors.append(f"manifest size/hash mismatch: {relative}")
        if sums.get(relative) != digest:
            errors.append(f"checksum mismatch: {relative}")
    if len(declared) != len(set(declared)):
        errors.append("manifest contains duplicate paths")
    declared_set = set(declared)
    if set(sums) != declared_set:
        errors.append("manifest and SHA256SUMS path sets differ")
    for relative in sorted(expected_paths - declared_set):
        errors.append(f"manifest omits managed file: {relative}")
    for relative in sorted(declared_set - expected_paths):
        errors.append(f"manifest declares unmanaged file: {relative}")
    return errors


def check_registry(root: Path, strict: bool) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    try:
        import jsonschema
    except ImportError:
        message = "jsonschema is unavailable; install requirements-dev.txt"
        (errors if strict else warnings).append(message)
        return errors, warnings
    try:
        registry = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
        schema = json.loads((root / "schemas/framework-v1.schema.json").read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator(schema).validate(registry)
    except Exception as error:
        errors.append(f"registry schema validation failed: {getattr(error, 'message', error)}")
    return errors, warnings


def repeated(values: list) -> list:
    return sorted({value for value in values if values.count(value) > 1}, key=repr)


def check_module_registry(root: Path, strict: bool) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    registry_path = root / "registry/modules-v1.json"
    schema_path = root / "schemas/modules-v1.schema.json"
    try:
        registry_text = registry_path.read_text(encoding="utf-8")
        registry = json.loads(registry_text)
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except Exception as error:
        return [f"module registry/schema cannot be read: {error}"], warnings
    if not isinstance(registry, dict):
        return ["module catalog root must be an object"], warnings

    schema_invalid = False
    try:
        import jsonschema
    except ImportError:
        message = "jsonschema is unavailable; module catalog schema was not validated"
        (errors if strict else warnings).append(message)
    else:
        try:
            jsonschema.Draft202012Validator.check_schema(schema)
            validator = jsonschema.Draft202012Validator(
                schema,
                format_checker=jsonschema.FormatChecker(),
            )
            schema_errors = sorted(validator.iter_errors(registry), key=lambda error: list(error.path))
            for error in schema_errors:
                location = "/".join(str(part) for part in error.path) or "$"
                errors.append(f"module catalog schema error at {location}: {error.message}")
            schema_invalid = bool(schema_errors)
        except Exception as error:
            errors.append(f"module catalog schema validation failed: {getattr(error, 'message', error)}")
            schema_invalid = True

    private_labels = sorted({label for value in walk_strings(registry) if (label := private_path_label(value))})
    for label in private_labels:
        errors.append(f"module catalog contains forbidden private {label}")
    if schema_invalid:
        return errors, warnings

    units = registry.get("units")
    if not isinstance(units, list):
        return errors + ["module catalog units must be an array"], warnings
    unit_records = [unit for unit in units if isinstance(unit, dict)]
    ids = [unit.get("id") for unit in unit_records]
    paths = [unit.get("publicPath") for unit in unit_records]
    records_by_id = {unit.get("id"): unit for unit in unit_records}
    duplicate_ids = repeated(ids)
    duplicate_paths = repeated(paths)
    if duplicate_ids:
        errors.append(f"duplicate unit IDs: {duplicate_ids}")
    if duplicate_paths:
        errors.append(f"duplicate public paths: {duplicate_paths}")

    legacy = registry.get("legacyChapterPlaceholders", [])
    legacy_ids = [item.get("legacyId") for item in legacy if isinstance(item, dict)]
    if repeated(legacy_ids):
        errors.append("duplicate legacy chapter IDs")
    reused = sorted(set(legacy_ids) & set(ids))
    if reused:
        errors.append(f"legacy chapter IDs reused by content units: {reused}")
    expected_legacy = [
        {
            "legacyId": f"CDX-M-{number:02d}01",
            "chapterId": f"ch{number:02d}",
            "publicPath": f"ch{number:02d}.html",
        }
        for number in range(1, 12)
    ]
    if legacy != expected_legacy:
        errors.append("legacy chapter mapping differs from the locked v1 allocation")

    collection_keys = [item.get("key") for item in registry.get("collections", []) if isinstance(item, dict)]
    task_keys = [item.get("key") for item in registry.get("taskTypes", []) if isinstance(item, dict)]
    if repeated(collection_keys):
        errors.append("duplicate prompt collection keys")
    if repeated(task_keys):
        errors.append("duplicate prompt task keys")
    for unit in unit_records:
        for collection_key in unit.get("collectionKeys", []):
            if collection_key not in collection_keys:
                errors.append(f"{unit.get('id')}: unknown collection key: {collection_key}")
        task_key = unit.get("taskKey")
        if task_key is not None and task_key not in task_keys:
            errors.append(f"{unit.get('id')}: unknown task key: {task_key}")
        for source_ref in unit.get("sourceRefs", []):
            problem = source_url_problem(source_ref["url"])
            if problem:
                errors.append(f"{unit.get('id')}: source URL {problem}: {source_ref['url']}")

    slots = []
    for unit in unit_records:
        if unit.get("kind") == "lesson-module":
            slots.append((unit.get("chapterId"), unit.get("order")))
        elif unit.get("kind") == "prompt-card":
            slots.extend((collection, unit.get("order")) for collection in unit.get("collectionKeys", []))
    duplicate_slots = repeated(slots)
    if duplicate_slots:
        errors.append(f"duplicate unit order within a container: {duplicate_slots}")

    sequence = 1
    for chapter_id, count in LOCKED_LESSON_COUNTS.items():
        for order in range(1, count + 1):
            unit_id = f"CDX-M-{sequence:04d}"
            record = records_by_id.get(unit_id)
            expected_identity = {
                "chapterId": chapter_id,
                "order": order,
                "sourceAnchor": f"s{order}",
                "publicPath": f"{chapter_id}.html#s{order}",
            }
            if record is None or any(record.get(key) != value for key, value in expected_identity.items()):
                errors.append(f"{unit_id}: permanent identity differs from the locked v1 allocation")
            elif record.get("risk") != LOCKED_CHAPTER_RISK[chapter_id]:
                errors.append(f"{unit_id}: risk differs from the locked chapter baseline")
            else:
                expected_platforms = (
                    ["windows"]
                    if unit_id == "CDX-M-0013"
                    else ["macos"]
                    if unit_id == "CDX-M-0014"
                    else ["windows", "macos"]
                )
                if record.get("platforms") != expected_platforms:
                    errors.append(f"{unit_id}: platforms differ from the locked v1 allocation")
            sequence += 1
    for prompt_id, task_key in LOCKED_PROMPT_TASKS.items():
        record = records_by_id.get(prompt_id)
        if record is None or record.get("taskKey") != task_key:
            errors.append(f"{prompt_id}: taskKey differs from the locked v1 allocation")
        elif record.get("risk") != "low" or record.get("platforms") != ["windows", "macos"]:
            errors.append(f"{prompt_id}: risk/platforms differ from the locked v1 allocation")

    framework = None
    try:
        framework = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
        if registry.get("contentPipeline") != framework["contentStatus"]["pipeline"]:
            errors.append("module content pipeline differs from framework registry")
        if registry.get("verificationStates") != framework["verification"]["states"]:
            errors.append("module verification states differ from framework registry")
        if registry.get("status") != framework.get("status"):
            errors.append("module catalog status differs from framework registry")
        expected_collections = [
            {"key": item["key"], "title": item["title"]}
            for item in framework["promptLibrary"]["collections"]
        ]
        if registry.get("collections") != expected_collections:
            errors.append("module collection taxonomy differs from framework registry")
        if [item.get("key") for item in registry.get("taskTypes", [])] != framework["promptLibrary"]["taskKeys"]:
            errors.append("module task taxonomy differs from framework registry")
        unique_cards = sum(item["uniqueCardCount"] for item in framework["promptLibrary"]["collections"])
        shared_card = framework["promptLibrary"]["sharedCard"]
        placement_count = unique_cards + shared_card["placementCount"] - 1
        if unique_cards != 26 or placement_count != 30:
            errors.append("prompt library totals differ from the locked 26-card/30-placement plan")
        if shared_card.get("id") != "PRM-COM-0003" or shared_card.get("taskKey") != "file-organization":
            errors.append("prompt shared-card identity differs from the locked plan")
        if shared_card.get("placementCollections") != collection_keys:
            errors.append("prompt shared-card collections do not close over the catalog taxonomy")
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        if registry.get("status") != manifest.get("status"):
            errors.append("module catalog status differs from artifact manifest")
        if registry.get("contentVersion") != manifest.get("version"):
            errors.append("module contentVersion differs from artifact version")
        if registry.get("generatedDate") != manifest.get("generatedDate"):
            errors.append("module generatedDate differs from artifact date")
    except Exception as error:
        errors.append(f"module catalog cross-registry check failed: {error}")

    if framework is not None:
        generated_date = date.fromisoformat(registry["generatedDate"])
        records = registry.get("verificationRecords", [])
        evidence_ids = [record["evidenceId"] for record in records]
        if repeated(evidence_ids):
            errors.append(f"duplicate verification evidence IDs: {repeated(evidence_ids)}")
        records_by_unit: dict[str, list[dict]] = {}
        for record in records:
            unit_id = record["unitId"]
            records_by_unit.setdefault(unit_id, []).append(record)
            unit = records_by_id.get(unit_id)
            if unit is None:
                errors.append(f"verification record references unknown unit: {unit_id}")
                continue
            if record["platform"] not in unit["platforms"]:
                errors.append(f"{unit_id}: verification record uses an undeclared platform")
            checked = date.fromisoformat(record["checkedDate"])
            expires = date.fromisoformat(record["expiresDate"])
            if checked > generated_date:
                errors.append(f"{unit_id}: verification date is later than the catalog date")
            if expires < checked:
                errors.append(f"{unit_id}: verification expiry precedes its check date")
            allowed_days = framework["verification"]["riskRevalidationDays"][unit["risk"]]
            if (expires - checked).days > allowed_days:
                errors.append(f"{unit_id}: verification expiry exceeds the {allowed_days}-day risk window")
            if expires < generated_date and unit["verificationState"] != "verification-expired":
                errors.append(f"{unit_id}: expired evidence is not reflected in verificationState")
        for unit in unit_records:
            unit_id = unit["id"]
            unit_records_for_verification = records_by_unit.get(unit_id, [])
            if unit["verificationState"] == "unverified":
                if unit_records_for_verification:
                    errors.append(f"{unit_id}: unverified unit must not carry verification records")
            elif not unit_records_for_verification:
                errors.append(f"{unit_id}: verification record missing for non-unverified state")
            else:
                latest_check = max(record["checkedDate"] for record in unit_records_for_verification)
                if unit["verificationDate"] != latest_check:
                    errors.append(f"{unit_id}: verificationDate does not match the latest evidence")
            if unit["contentStatus"] == "stable":
                covered = {record["platform"] for record in unit_records_for_verification}
                if covered != set(unit["platforms"]):
                    errors.append(f"{unit_id}: stable unit lacks evidence for every declared platform")
            if unit["lastReviewedDate"] and date.fromisoformat(unit["lastReviewedDate"]) > generated_date:
                errors.append(f"{unit_id}: lastReviewedDate is later than the catalog date")
            for source_ref in unit["sourceRefs"]:
                if date.fromisoformat(source_ref["reviewDate"]) > generated_date:
                    errors.append(f"{unit_id}: source reviewDate is later than the catalog date")

    parsed_units = []
    registered_content_pages: set[Path] = set()
    chapter_ids = [item.get("chapterId") for item in legacy if isinstance(item, dict)]
    for chapter_id in chapter_ids:
        page = root / f"{chapter_id}.html"
        if not page.is_file():
            errors.append(f"module chapter page missing: {page.name}")
            continue
        registered_content_pages.add(page.resolve())
        page_units, summaries, unregistered_sections, _ = parse_content_units(page)
        if summaries != ["summary"]:
            errors.append(f"{page.name}: expected exactly one #summary chapter summary")
        if unregistered_sections:
            errors.append(f"{page.name}: unregistered numbered sections: {unregistered_sections}")
        for order, unit in enumerate(page_units, 1):
            parsed_units.append(
                {
                    **unit,
                    "kind": "lesson-module",
                    "chapterId": chapter_id,
                    "order": order,
                    "publicPath": f"{page.name}#{unit['anchor']}",
                }
            )

    prompt_page = root / "prompts.html"
    if prompt_page.is_file():
        registered_content_pages.add(prompt_page.resolve())
        prompt_units, _, _, unregistered_cards = parse_content_units(prompt_page)
        if unregistered_cards:
            errors.append(f"prompts.html: unregistered prompt cards: {unregistered_cards}")
        collection_positions: dict[str, int] = {}
        for unit in prompt_units:
            record = records_by_id.get(unit.get("id"), {})
            collections = record.get("collectionKeys") or ["unregistered"]
            primary_collection = collections[0]
            collection_positions[primary_collection] = collection_positions.get(primary_collection, 0) + 1
            parsed_units.append(
                {
                    **unit,
                    "kind": "prompt-card",
                    "chapterId": None,
                    "order": collection_positions[primary_collection],
                    "publicPath": f"prompts.html#{unit['anchor']}",
                }
            )
    else:
        errors.append("prompt page missing: prompts.html")

    for page in public_html_files(root):
        if page.resolve() in registered_content_pages:
            continue
        outside_units, _, _, _ = parse_content_units(page)
        if outside_units:
            errors.append(
                f"{page.relative_to(root).as_posix()}: data-unit-id appears outside registered content pages"
            )

    parsed_ids = [unit.get("id") for unit in parsed_units]
    if repeated(parsed_ids):
        errors.append(f"duplicate data-unit-id values in HTML: {repeated(parsed_ids)}")
    if set(ids) != set(parsed_ids):
        missing_html = sorted(set(ids) - set(parsed_ids))
        missing_registry = sorted(set(parsed_ids) - set(ids))
        errors.append(
            "unit ID set differs between registry and HTML "
            f"(missing HTML: {missing_html}; missing registry: {missing_registry})"
        )

    for parsed in parsed_units:
        record = records_by_id.get(parsed.get("id"))
        if record is None:
            continue
        for field in ("title", "kind", "chapterId", "order", "publicPath"):
            if record.get(field) != parsed.get(field):
                errors.append(
                    f"{parsed.get('id')}: {field} differs between registry and HTML "
                    f"({record.get(field)!r} != {parsed.get(field)!r})"
                )
        if record.get("sourceAnchor") != parsed.get("anchor"):
            errors.append(f"{parsed.get('id')}: sourceAnchor differs from HTML anchor")
    return errors, warnings


def check_offline_zip(root: Path, chapter_config: dict, strict: bool) -> list[str]:
    errors = []
    version = chapter_config["site"]["version"]
    archive = root / "downloads" / f"codex-tutorial-cn-v{version}-offline.zip"
    checksum_path = archive.with_name(archive.name + ".sha256")
    if not archive.is_file():
        return [f"ZIP missing: {archive.name}"]
    try:
        checksum = checksum_records(checksum_path.read_text(encoding="ascii"))
    except Exception as error:
        errors.append(f"ZIP checksum cannot be read: {error}")
        checksum = {}
    if checksum.get(archive.name) != sha256(archive.read_bytes()):
        errors.append("ZIP external checksum mismatch")

    prefix = "codex-tutorial-cn/"
    try:
        with zipfile.ZipFile(archive) as package:
            names = package.namelist()
            if len(names) != len(set(names)):
                errors.append("ZIP contains duplicate paths")
            for name in names:
                if not name.startswith(prefix) or not safe_relative(name):
                    errors.append(f"ZIP has unsafe path: {name}")
            files = {
                name[len(prefix):]
                for name in names
                if name.startswith(prefix) and not name.endswith("/")
            }
            manifest = json.loads(package.read(prefix + "manifest.json").decode("utf-8"))
            sums = checksum_records(package.read(prefix + "SHA256SUMS.txt").decode("utf-8"))
            payload_paths = files - {"manifest.json", "SHA256SUMS.txt"}
            online_only = payload_paths & {"404.html", "robots.txt"}
            if online_only:
                errors.append(f"ZIP contains online-only files: {sorted(online_only)}")
            records = manifest.get("files", [])
            declared = {record.get("path") for record in records if isinstance(record, dict)}
            if declared != payload_paths or set(sums) != payload_paths:
                errors.append("manifest/checksum file set differs from ZIP payload")
            for record in records:
                relative = record.get("path")
                if relative not in payload_paths:
                    continue
                payload = package.read(prefix + relative)
                digest = sha256(payload)
                if (
                    record.get("size") != len(payload)
                    or record.get("sha256") != digest
                    or sums.get(relative) != digest
                ):
                    errors.append(f"manifest/checksum mismatch: {relative}")
            if not errors:
                with tempfile.TemporaryDirectory(prefix="codex-tutorial-check-") as directory:
                    package.extractall(directory)
                    package_root = Path(directory) / "codex-tutorial-cn"
                    link_errors, _, _ = check_site_tree(
                        package_root,
                        allow_root_relative=False,
                    )
                    errors.extend(link_errors)
                    errors.extend(check_public_text_safety(package_root, payload_paths | MANAGED_METADATA))
                    module_errors, _ = check_module_registry(package_root, strict)
                    errors.extend(f"module catalog: {message}" for message in module_errors)
    except Exception as error:
        errors.append(f"ZIP cannot be validated: {error}")
    return errors


def generated_paths(root: Path, chapter_config: dict) -> set[str]:
    paths = managed_public_paths(root, chapter_config)
    paths.update(MANAGED_METADATA)
    paths.update(expected_download_paths(chapter_config))
    downloads = root / "downloads"
    if downloads.is_dir():
        paths.update(
            path.relative_to(root).as_posix()
            for path in downloads.rglob("*")
            if path.is_file()
        )
    return paths


def check_generated_sync(root: Path, chapter_config: dict) -> list[str]:
    errors = []
    with tempfile.TemporaryDirectory(prefix="codex-tutorial-rebuild-") as directory:
        candidate = Path(directory) / "repo"
        shutil.copytree(
            root,
            candidate,
            ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", "preview.html"),
        )
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["PYTHONUTF8"] = "1"
        result = subprocess.run(
            [sys.executable, "src/build.py"],
            cwd=candidate,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if result.returncode:
            return ["generated verification rebuild failed"]
        try:
            expected_paths = generated_paths(root, chapter_config)
            actual_paths = generated_paths(candidate, chapter_config)
        except Exception as error:
            return [f"generated file inventory cannot be read: {error}"]
        if expected_paths != actual_paths:
            errors.append("generated file sets differ from source build")
        for relative in sorted(expected_paths & actual_paths):
            expected_path = root.joinpath(*relative.split("/"))
            actual_path = candidate.joinpath(*relative.split("/"))
            if not expected_path.is_file() or not actual_path.is_file():
                errors.append(f"generated output missing from one tree: {relative}")
                continue
            expected = expected_path.read_bytes()
            actual = actual_path.read_bytes()
            if expected != actual:
                errors.append(f"generated output differs from source build: {relative}")
    return errors


def main() -> int:
    configure_output()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="require JSON Schema validation")
    parser.add_argument("--verify-generated", action="store_true", help="rebuild in a temporary copy and compare bytes")
    arguments = parser.parse_args()

    config = json.loads((ROOT / "src/chapters.json").read_text(encoding="utf-8"))
    errors, warnings = [], []
    site_errors, page_count, link_count = check_site_tree(ROOT, config)
    errors.extend(site_errors)
    expected_manifest_paths = managed_public_paths(ROOT, config)
    errors.extend(check_public_root_inventory(ROOT, expected_manifest_paths))
    errors.extend(check_download_inventory(ROOT, config))
    errors.extend(check_public_text_safety(ROOT, expected_manifest_paths | MANAGED_METADATA))
    errors.extend(f"manifest: {message}" for message in check_manifest(ROOT, expected_manifest_paths))
    registry_errors, registry_warnings = check_registry(ROOT, arguments.strict)
    errors.extend(registry_errors)
    warnings.extend(registry_warnings)
    module_errors, module_warnings = check_module_registry(ROOT, arguments.strict)
    errors.extend(f"modules: {message}" for message in module_errors)
    warnings.extend(f"modules: {message}" for message in module_warnings)
    errors.extend(f"offline: {message}" for message in check_offline_zip(ROOT, config, arguments.strict))
    if arguments.verify_generated:
        errors.extend(check_generated_sync(ROOT, config))

    print(f"checked {page_count} HTML pages and {link_count} local links")
    for warning in warnings:
        print(f"[WARN] {warning}")
    for error in errors:
        print(f"[ERROR] {error}")
    if errors:
        print(f"[ERROR] release checks failed: {len(errors)} issue(s)")
        return 1
    print("[OK] all requested release checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
