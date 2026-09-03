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
import socket
import stat
import subprocess
import sys
import tempfile
import unicodedata
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
PUBLIC_TEXT_SUFFIXES = {".cfg", ".conf", ".css", ".htm", ".html", ".ini", ".json", ".md", ".sha256", ".svg", ".toml", ".txt", ".xhtml", ".xml", ".yaml", ".yml"}
PUBLIC_TEXT_NAMES = {"Caddyfile", "Dockerfile"}
PUBLIC_BINARY_SUFFIXES = {".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".webp"}
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
SENSITIVE_REPOSITORY_SUFFIXES = {".env", ".key", ".kdbx", ".p12", ".pem", ".pfx", ".sqlite", ".sqlite3"}
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
LOCKED_TASK_TITLES = {
    "communication": "沟通协作",
    "document-report": "文档报告",
    "file-organization": "文件整理",
    "table-data": "表格数据",
    "research-plan": "调研计划",
    "visual": "视觉创意",
}
LOCKED_PROMPT_COLLECTIONS = [
    {"key": "prompt-common", "title": "跨行业通用", "uniqueCardCount": 6, "usesSharedFileCard": False},
    {"key": "prompt-ecommerce", "title": "电商与零售", "uniqueCardCount": 5, "usesSharedFileCard": True},
    {"key": "prompt-food", "title": "餐饮与本地生活", "uniqueCardCount": 5, "usesSharedFileCard": True},
    {"key": "prompt-media", "title": "传媒与内容创作", "uniqueCardCount": 5, "usesSharedFileCard": True},
    {"key": "prompt-education", "title": "教育与培训", "uniqueCardCount": 5, "usesSharedFileCard": True},
]
LOCKED_ACTIVE_PROMPT_COUNTS = {
    item["key"]: item["uniqueCardCount"] for item in LOCKED_PROMPT_COLLECTIONS
}
LOCKED_RISK_WINDOWS = {"high": 30, "medium": 90, "low": 180}
LOCKED_STABLE_GATES = [
    "framework-user-approved",
    "all-required-content-acceptance-ready",
    "source-and-rights-clear",
    "required-platform-verification-complete",
    "offline-build-and-links-pass",
    "accessibility-and-safety-gates-pass",
    "release-artifacts-reproducible",
]


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


def reject_duplicate_json_keys(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def json_loads_strict(source: str):
    return json.loads(source, object_pairs_hook=reject_duplicate_json_keys)


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
        (r"(?<![A-Za-z])[A-Za-z]:(?:[\\/]|Users(?:[\\/]|$))", "drive path"),
        (r"(?:^|[^\\])\\\\[^\\\s]+[\\/]", "UNC path"),
        (r"(?<![:/])//[^/\s]+/", "forward-slash UNC path"),
        (r"(?i)file://", "file URL"),
        (r"(?i)(?:^|[\\/])\.(?:codex|superpowers)(?:[\\/]|$)", "private tool path"),
        (r"(?i)(?:^|[\\/])worktrees(?:[\\/]|$)", "private worktree path"),
        (r"(?i)/(?:Users|home)/[^/\s]+(?:/|$)", "private home path"),
        (r"(?i)/(?:mnt/[^/\s]+|root)(?:/|$)", "private host path"),
        (r"(?<![A-Za-z0-9_.-])\.\.(?:[\\/]|$)", "parent traversal"),
    )
    for pattern, label in checks:
        if re.search(pattern, value):
            return label
    return None


def decoded_text_variants(value: str) -> set[str]:
    variants = {value}
    frontier = {value}
    for _ in range(12):
        expanded = set()
        for item in frontier:
            expanded.update((html.unescape(item), unquote(item)))
        expanded -= variants
        if not expanded:
            break
        variants.update(expanded)
        frontier = expanded
    return variants


def binary_file_problem(path: Path) -> str | None:
    if path.stat().st_size > 20 * 1024 * 1024:
        return "binary asset exceeds 20 MiB"
    header = path.read_bytes()[:32]
    suffix = path.suffix.lower()
    signatures = {
        ".png": header.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": header.startswith(b"\xff\xd8\xff"),
        ".jpeg": header.startswith(b"\xff\xd8\xff"),
        ".gif": header.startswith((b"GIF87a", b"GIF89a")),
        ".webp": header.startswith(b"RIFF") and header[8:12] == b"WEBP",
        ".ico": header.startswith(b"\x00\x00\x01\x00"),
        ".avif": len(header) >= 12 and header[4:8] == b"ftyp" and b"avif" in header[8:32],
    }
    if not signatures.get(suffix, False):
        return "binary asset does not match its file extension"
    return None


def check_public_text_safety(root: Path, relative_paths: set[str]) -> list[str]:
    errors = []
    for relative in sorted(relative_paths):
        path = root.joinpath(*relative.split("/"))
        if not path.is_file():
            continue
        if path.is_symlink():
            errors.append(f"{relative}: public artifact must not be a symbolic link")
            continue
        if path.suffix.lower() in PUBLIC_BINARY_SUFFIXES:
            if problem := binary_file_problem(path):
                errors.append(f"{relative}: {problem}")
            continue
        if path.suffix.lower() not in PUBLIC_TEXT_SUFFIXES and path.name not in PUBLIC_TEXT_NAMES:
            errors.append(f"{relative}: unsupported public file type")
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"{relative}: declared text artifact is not UTF-8")
            continue
        values = list(decoded_text_variants(source))
        if path.suffix.lower() == ".css":
            values.extend(decoded_text_variants(normalize_css(source)))
        if path.suffix.lower() == ".json":
            try:
                decoded_values = list(walk_strings(json_loads_strict(source)))
                values = []
                for value in decoded_values:
                    values.extend(decoded_text_variants(value))
            except (json.JSONDecodeError, ValueError) as error:
                errors.append(f"{relative}: invalid JSON text: {error}")
        labels = set()
        html_like = path.suffix.lower() in {".htm", ".html", ".xhtml"}
        for value in values:
            label = private_path_label(value)
            if label and not (html_like and label == "parent traversal"):
                labels.add(label)
        if html_like:
            visible_text = re.sub(r"<[^>]+>", " ", source)
            for value in decoded_text_variants(visible_text):
                if label := private_path_label(value):
                    labels.add(label)
        labels = sorted(labels)
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
    try:
        parsed.port
    except ValueError:
        return "contains an invalid port"
    host = parsed.hostname
    for _ in range(12):
        decoded = unquote(host)
        if decoded == host:
            break
        host = decoded
    host = host.rstrip(".").lower()
    if not host or any(character in host for character in "/\\%\x00\r\n\t"):
        return "contains an invalid hostname"
    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError:
        return "contains an invalid hostname"
    host = host.rstrip(".")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        return "must not use a local hostname"
    if "." not in host and ":" not in host:
        try:
            packed = socket.inet_aton(host)
        except OSError:
            return "must use a fully qualified public hostname"
        address = ipaddress.ip_address(packed)
        if not address.is_global or address.is_multicast:
            return "must not use a private or special IP address"
    elif re.fullmatch(r"[0-9A-Fa-fxX.]+", host):
        try:
            address = ipaddress.ip_address(socket.inet_aton(host))
        except OSError:
            return "contains an invalid numeric hostname"
        if not address.is_global or address.is_multicast:
            return "must not use a private or special IP address"
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if host.endswith((".invalid", ".test", ".example")):
            return "must use a resolvable public hostname"
    else:
        if not address.is_global or address.is_multicast:
            return "must not use a private or special IP address"
    sensitive_names = {
        "token",
        "accesstoken",
        "refreshtoken",
        "idtoken",
        "key",
        "apikey",
        "secret",
        "clientsecret",
        "password",
        "passwd",
        "auth",
        "authorization",
        "signature",
        "sig",
        "credential",
        "credentials",
        "xamzsignature",
        "xamzcredential",
        "xamzsecuritytoken",
        "oauthtoken",
        "authtoken",
        "sessiontoken",
        "sessionid",
        "awsaccesskeyid",
    }

    def sensitive_parameter_name(name: str) -> bool:
        for _ in range(12):
            decoded = unquote(name)
            if decoded == name:
                break
            name = decoded
        return re.sub(r"[^a-z0-9]", "", name.lower()) in sensitive_names

    for location, payload in (("path", parsed.path), ("query", parsed.query), ("fragment", parsed.fragment)):
        for decoded_payload in decoded_text_variants(payload):
            names = [
                name
                for name, _ in parse_qsl(decoded_payload.replace(";", "&"), keep_blank_values=True)
            ]
            names.extend(re.findall(r"(?:^|[?&#;/])([^=?&#;/]+)=", decoded_payload))
            for name in names:
                if sensitive_parameter_name(name):
                    return f"must not contain sensitive {location} parameter {name!r}"
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
    value = re.sub(r"（PRM-[A-Z]+-\d{4}）\s*$", "", value)
    return value.strip()


class ContentUnitParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.units: list[dict] = []
        self.summary_anchors: list[str | None] = []
        self.unregistered_numbered_sections: list[str] = []
        self.unregistered_prompt_cards: list[str | None] = []
        self.unexpected_unit_elements: list[str] = []
        self._sections: list[dict | None] = []
        self._capture_heading = False
        self._heading_badge_depth = 0

    def close(self) -> None:
        super().close()
        for section in self._sections:
            if section is not None:
                self.unexpected_unit_elements.append(
                    f"unclosed section[data-unit-id={section['id']}]"
                )
        self._sections = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {name.lower(): value or "" for name, value in attrs}
        classes = attributes.get("class", "").split()
        if self._sections and self._sections[-1] is not None and "retirement-notice" in classes:
            self._sections[-1]["retirementNotice"] = True
        if tag != "section" and attributes.get("data-unit-id"):
            self.unexpected_unit_elements.append(f"{tag}[data-unit-id={attributes['data-unit-id']}]")
        if tag == "section":
            if "summary" in attributes.get("class", "").split():
                self.summary_anchors.append(attributes.get("id"))
            unit_id = attributes.get("data-unit-id")
            anchor = attributes.get("id")
            if re.fullmatch(r"s[1-9][0-9]*", anchor or "") and not unit_id:
                self.unregistered_numbered_sections.append(anchor)
            if "prompt-card" in classes and not unit_id:
                self.unregistered_prompt_cards.append(anchor)
            self._sections.append(
                {
                    "id": unit_id,
                    "anchor": anchor,
                    "heading": [],
                    "contentStatus": attributes.get("data-content-status"),
                    "verificationState": attributes.get("data-verification-state"),
                    "collectionKeys": attributes.get("data-collection-keys", "").split(),
                    "taskKey": attributes.get("data-task-key") or None,
                    "visibleStatus": None,
                    "visibleStatusLabel": [],
                    "retirementNotice": False,
                }
                if unit_id
                else None
            )
        elif tag == "h2" and self._sections and self._sections[-1] is not None:
            self._capture_heading = True
        elif self._capture_heading and self._sections and self._sections[-1] is not None:
            classes = attributes.get("class", "").split()
            if tag == "span" and "badge" in classes and self._heading_badge_depth == 0:
                statuses = [value for value in classes if value != "badge"]
                self._sections[-1]["visibleStatus"] = statuses[0] if len(statuses) == 1 else None
                self._heading_badge_depth = 1
            elif self._heading_badge_depth:
                self._heading_badge_depth += 1

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "h2":
            self._capture_heading = False
            self._heading_badge_depth = 0
        elif self._capture_heading and self._heading_badge_depth:
            self._heading_badge_depth -= 1
        elif tag == "section" and self._sections:
            section = self._sections.pop()
            if section is not None:
                section["title"] = normalize_unit_heading("".join(section.pop("heading")))
                section["visibleStatusLabel"] = " ".join(section["visibleStatusLabel"]).strip()
                self.units.append(section)

    def handle_data(self, data: str) -> None:
        if self._capture_heading and self._sections and self._sections[-1] is not None:
            field = "visibleStatusLabel" if self._heading_badge_depth else "heading"
            self._sections[-1][field].append(data)


def parse_content_units(
    path: Path,
) -> tuple[list[dict], list[str | None], list[str], list[str | None], list[str]]:
    parser = ContentUnitParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return (
        parser.units,
        parser.summary_anchors,
        parser.unregistered_numbered_sections,
        parser.unregistered_prompt_cards,
        parser.unexpected_unit_elements,
    )


def prompt_taxonomy_labels(path: Path) -> dict[str, tuple[str, str]]:
    source = path.read_text(encoding="utf-8")
    result = {}
    for match in re.finditer(
        r'<section\b(?=[^>]*\bclass="[^"]*\bprompt-card\b)(?=[^>]*\bdata-unit-id="([^"]+)")[^>]*>(.*?)</section>',
        source,
        flags=re.S,
    ):
        unit_id, body = match.groups()
        taxonomy = re.search(r"<dt>\s*行业\s*/\s*任务分类\s*</dt>\s*<dd>(.*?)</dd>", body, flags=re.S)
        if not taxonomy:
            continue
        value = " ".join(html.unescape(re.sub(r"<[^>]+>", "", taxonomy.group(1))).split())
        parts = [part.strip() for part in re.split(r"[；｜|]", value, maxsplit=1)]
        if len(parts) == 2:
            result[unit_id] = (parts[0], parts[1])
    return result


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


def portable_archive_path_key(value: str) -> str | None:
    normalized = unicodedata.normalize("NFC", value.replace("\\", "/"))
    if normalized != value or not safe_relative(normalized):
        return None
    portable_parts = []
    reserved = {"con", "prn", "aux", "nul"}
    reserved.update(f"com{number}" for number in range(1, 10))
    reserved.update(f"lpt{number}" for number in range(1, 10))
    for part in normalized.split("/"):
        stripped = part.rstrip(" .")
        if stripped != part:
            return None
        portable = stripped.casefold()
        if not portable or portable.split(".", 1)[0] in reserved:
            return None
        portable_parts.append(portable)
    return "/".join(portable_parts)


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
        if relative.parts and relative.parts[0] in EXCLUDED_PUBLIC_PARTS:
            continue
        files.append(path)
    return sorted(files)


def public_css_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() != ".css":
            continue
        relative = path.relative_to(root)
        if relative.parts and relative.parts[0] in EXCLUDED_PUBLIC_PARTS:
            continue
        files.append(path)
    return sorted(files)


def public_svg_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() != ".svg":
            continue
        relative = path.relative_to(root)
        if relative.parts and relative.parts[0] in EXCLUDED_PUBLIC_PARTS:
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
        if not reference:
            return False
        if is_remote_url(reference) or lower.startswith(("http://", "https://")):
            if context == "a[href]":
                problem = source_url_problem(reference)
                if problem:
                    errors.append(f"{relative}: external navigation URL {problem}: {reference}")
            return False
        if lower.startswith(("mailto:", "tel:") + EMBEDDED_SCHEMES):
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
                    r'<p class="kicker">第 \d+ 章 <span class="badge ([\w-]+)">([^<]+)</span>',
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


def check_repository_tree(root: Path, chapter_config: dict) -> list[str]:
    errors = []
    allowed = managed_public_paths(root, chapter_config) | MANAGED_METADATA | expected_download_paths(chapter_config)
    allowed.update({".dockerignore", ".gitattributes", ".gitignore", "requirements-dev.txt"})
    allowed.update({"tests/test_build.py", "tests/test_check.py", "tests/test_module_registry.py"})
    allowed.add(".github/workflows/quality.yml")
    source_patterns = [
        r"src/(?:build\.py|chapters\.json|check\.py|modules-v1\.json|preview\.html)",
        r"src/content/(?:ch(?:0[1-9]|1[01])\.html|prompts\.html|style\.css)",
        r"src/deploy/(?:Caddyfile|DEPLOY\.md|Dockerfile|docker-compose\.yml|nginx(?:\.docker)?\.conf)",
        r"src/research/(?:notes|sources)\.md",
        r"src/maintainer/(?:framework-v1\.json|maintenance-release\.html|notion-workflow\.html|source-research\.html)",
        r"src/maintainer/(?:plans|specs)/[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.html",
        r"src/maintainer/templates/(?:module|plugin|prompt-card|skill|source-review|verification)-template\.html",
        r"src/maintainer/schemas/(?:framework|modules)-v1\.schema\.json",
    ]
    has_git_metadata = (root / ".git").exists()
    git_result = None
    if has_git_metadata:
        git_result = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    fallback_worktree = git_result is not None and git_result.returncode != 0
    if git_result is not None and git_result.returncode == 0:
        relatives = [value for value in git_result.stdout.decode("utf-8").split("\0") if value]
    else:
        relatives = [
            path.relative_to(root).as_posix()
            for path in root.rglob("*")
            if path.is_file() or path.is_symlink()
        ]
    for relative in sorted(set(relatives)):
        relative_path = Path(relative)
        path = root.joinpath(*relative_path.parts)
        if relative == ".git":
            continue
        if (git_result is None or git_result.returncode != 0) and "__pycache__" in relative_path.parts and path.suffix.lower() == ".pyc":
            continue
        if fallback_worktree and any(part in {".venv", "__pycache__"} for part in relative_path.parts):
            continue
        if path.is_symlink():
            errors.append(f"repository file must not be a symbolic link: {relative}")
            continue
        if path.suffix.lower() in SENSITIVE_REPOSITORY_SUFFIXES or path.name.lower() == ".env":
            errors.append(f"sensitive repository file type is not allowed: {relative}")
        if relative not in allowed and not any(re.fullmatch(pattern, relative) for pattern in source_patterns):
            errors.append(f"repository path is outside the explicit public-source whitelist: {relative}")
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
        manifest = json_loads_strict((root / "manifest.json").read_text(encoding="utf-8"))
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
        registry = json_loads_strict((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
        schema = json_loads_strict((root / "schemas/framework-v1.schema.json").read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator.check_schema(schema)
        jsonschema.Draft202012Validator(schema).validate(registry)
    except Exception as error:
        errors.append(f"registry schema validation failed: {getattr(error, 'message', error)}")
    return errors, warnings


def repeated(values: list) -> list:
    return sorted({value for value in values if values.count(value) > 1}, key=repr)


def check_module_registry(
    root: Path,
    strict: bool,
    *,
    as_of: date | None = None,
) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    registry_path = root / "registry/modules-v1.json"
    schema_path = root / "schemas/modules-v1.schema.json"
    try:
        registry_text = registry_path.read_text(encoding="utf-8")
        registry = json_loads_strict(registry_text)
        schema = json_loads_strict(schema_path.read_text(encoding="utf-8"))
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

    generated_date = date.fromisoformat(registry["generatedDate"])
    runtime_date = as_of or date.today()
    if generated_date > runtime_date:
        errors.append("module catalog generatedDate is in the future")
    retirement_records = registry.get("retirementRecords", [])
    retirement_ids = [record["unitId"] for record in retirement_records]
    duplicate_retirements = repeated(retirement_ids)
    if duplicate_retirements:
        errors.append(f"duplicate retirement tombstones: {duplicate_retirements}")
    retirements_by_id = {record["unitId"]: record for record in retirement_records}
    registered_paths = set(paths)
    records_by_path = {unit["publicPath"]: unit for unit in unit_records}
    for record in retirement_records:
        unit_id = record["unitId"]
        unit = records_by_id.get(unit_id)
        if unit is None:
            errors.append(f"retirement tombstone references unknown unit: {unit_id}")
            continue
        if unit["contentStatus"] != "retired":
            errors.append(f"{unit_id}: non-retired unit has a retirement tombstone")
        if date.fromisoformat(record["retiredDate"]) > generated_date:
            errors.append(f"{unit_id}: retirement date is later than the catalog date")
        replacement = record["replacementPath"]
        if replacement is not None and replacement not in registered_paths:
            errors.append(f"{unit_id}: retirement replacementPath is not a registered unit path")
        elif replacement is not None and records_by_path[replacement]["contentStatus"] == "retired":
            errors.append(f"{unit_id}: retirement replacementPath points to another retired unit")
        if replacement == unit["publicPath"]:
            errors.append(f"{unit_id}: retirement replacementPath points to the retired unit itself")
    for unit in unit_records:
        if unit["contentStatus"] == "retired" and unit["id"] not in retirements_by_id:
            errors.append(f"{unit['id']}: retirement tombstone missing")
    if registry.get("status") in {"acceptance-ready", "stable"}:
        active_states = {"acceptance-ready", "stable"}
        for chapter_id, required_count in LOCKED_LESSON_COUNTS.items():
            active_count = sum(
                1
                for unit in unit_records
                if unit.get("kind") == "lesson-module"
                and unit.get("chapterId") == chapter_id
                and unit.get("contentStatus") in active_states
            )
            if active_count < required_count:
                errors.append(
                    f"{chapter_id}: active lesson coverage is below the locked minimum "
                    f"({active_count} < {required_count})"
                )
        active_prompts = [
            unit
            for unit in unit_records
            if unit.get("kind") == "prompt-card" and unit.get("contentStatus") in active_states
        ]
        if len(active_prompts) < 26:
            errors.append(f"active prompt coverage is below the locked minimum ({len(active_prompts)} < 26)")
        for collection_key, required_count in LOCKED_ACTIVE_PROMPT_COUNTS.items():
            active_count = sum(
                1 for unit in active_prompts if collection_key in unit.get("collectionKeys", [])
            )
            if active_count < required_count:
                errors.append(
                    f"{collection_key}: active prompt coverage is below the locked minimum "
                    f"({active_count} < {required_count})"
                )

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
    expected_task_types = [{"key": key, "title": title} for key, title in LOCKED_TASK_TITLES.items()]
    if registry.get("taskTypes") != expected_task_types:
        errors.append("module task titles differ from the locked v1 taxonomy")
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
        if unit.get("kind") == "prompt-card":
            expected_anchor = str(unit.get("id", "")).lower()
            if (
                unit.get("sourceAnchor") != expected_anchor
                or unit.get("publicPath") != f"prompts.html#{expected_anchor}"
            ):
                errors.append(f"{unit.get('id')}: prompt ID does not match its anchor/public path")

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
        elif (
            record.get("sourceAnchor") != prompt_id.lower()
            or record.get("publicPath") != f"prompts.html#{prompt_id.lower()}"
        ):
            errors.append(f"{prompt_id}: permanent prompt identity differs from the locked v1 allocation")
        elif record.get("risk") != "low" or record.get("platforms") != ["windows", "macos"]:
            errors.append(f"{prompt_id}: risk/platforms differ from the locked v1 allocation")

    framework = None
    try:
        framework = json_loads_strict((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
        if registry.get("contentPipeline") != framework["contentStatus"]["pipeline"]:
            errors.append("module content pipeline differs from framework registry")
        if registry.get("verificationStates") != framework["verification"]["states"]:
            errors.append("module verification states differ from framework registry")
        if registry.get("status") != framework.get("status"):
            errors.append("module catalog status differs from framework registry")
        pipeline_index = {status: index for index, status in enumerate(registry["contentPipeline"])}
        framework_chapters = {f"ch{item['number']:02d}": item for item in framework["chapters"]}
        for chapter_id in LOCKED_LESSON_COUNTS:
            chapter_units = [unit for unit in unit_records if unit.get("chapterId") == chapter_id]
            expected_status = min(
                (unit["contentStatus"] for unit in chapter_units),
                key=pipeline_index.__getitem__,
            )
            if framework_chapters.get(chapter_id, {}).get("status") != expected_status:
                errors.append(f"{chapter_id}: chapter status differs from its least-advanced unit")
        expected_collections = [
            {"key": item["key"], "title": item["title"]}
            for item in framework["promptLibrary"]["collections"]
        ]
        if registry.get("collections") != expected_collections:
            errors.append("module collection taxonomy differs from framework registry")
        if [item.get("key") for item in registry.get("taskTypes", [])] != framework["promptLibrary"]["taskKeys"]:
            errors.append("module task taxonomy differs from framework registry")
        prompt_library = framework["promptLibrary"]
        if prompt_library["collections"] != LOCKED_PROMPT_COLLECTIONS:
            errors.append("framework prompt collection plan differs from the locked v1 allocation")
        if prompt_library.get("uniqueCardCount") != 26 or prompt_library.get("placementCount") != 30:
            errors.append("framework prompt totals differ from the locked 26-card/30-placement plan")
        unique_cards = sum(item["uniqueCardCount"] for item in prompt_library["collections"])
        shared_card = prompt_library["sharedCard"]
        placement_count = unique_cards + shared_card["placementCount"] - 1
        if unique_cards != 26 or placement_count != 30:
            errors.append("prompt library totals differ from the locked 26-card/30-placement plan")
        if shared_card.get("id") != "PRM-COM-0003" or shared_card.get("taskKey") != "file-organization":
            errors.append("prompt shared-card identity differs from the locked plan")
        if shared_card.get("placementCollections") != collection_keys:
            errors.append("prompt shared-card collections do not close over the catalog taxonomy")
        if framework["verification"].get("riskRevalidationDays") != LOCKED_RISK_WINDOWS:
            errors.append("framework risk revalidation windows differ from the locked policy")
        if framework.get("releaseGate", {}).get("requiredBeforeStable") != LOCKED_STABLE_GATES:
            errors.append("stable release gates differ from the locked policy")
        expected_decisions = {
            "draft-seed-unverified": "course-beta-in-development",
            "review-in-progress": "course-beta-in-development",
            "acceptance-ready": "course-acceptance-pending",
            "stable": "course-stable-approved",
            "retired": "course-retired",
        }
        expected_decision = expected_decisions.get(registry.get("status"))
        if framework.get("releaseGate", {}).get("currentDecision") != expected_decision:
            errors.append("release gate decision is incompatible with the catalog status")
        if registry.get("status") == "stable":
            seed = framework.get("currentSeedContent", {})
            if (
                not seed.get("final")
                or not seed.get("countsAsCompletedCourseContent")
                or seed.get("designation") != "formal-course"
                or seed.get("reviewPolicy") != "accepted-item-by-item"
            ):
                errors.append("stable catalog is not marked as final completed course content")
        manifest = json_loads_strict((root / "manifest.json").read_text(encoding="utf-8"))
        if registry.get("status") != manifest.get("status"):
            errors.append("module catalog status differs from artifact manifest")
        if registry.get("contentVersion") != manifest.get("version"):
            errors.append("module contentVersion differs from artifact version")
        if registry.get("generatedDate") != manifest.get("generatedDate"):
            errors.append("module generatedDate differs from artifact date")
    except Exception as error:
        errors.append(f"module catalog cross-registry check failed: {error}")

    if framework is not None:
        evaluation_date = max(generated_date, runtime_date)
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
            allowed_days = LOCKED_RISK_WINDOWS[unit["risk"]]
            if (expires - checked).days > allowed_days:
                errors.append(f"{unit_id}: verification expiry exceeds the {allowed_days}-day risk window")
        for unit in unit_records:
            unit_id = unit["id"]
            unit_records_for_verification = records_by_unit.get(unit_id, [])
            latest_by_platform = {}
            for record in unit_records_for_verification:
                platform = record["platform"]
                previous = latest_by_platform.get(platform)
                if previous is None or record["checkedDate"] > previous["checkedDate"]:
                    latest_by_platform[platform] = record
                elif record["checkedDate"] == previous["checkedDate"]:
                    errors.append(f"{unit_id}: ambiguous latest verification records for {platform}")
            latest_records = list(latest_by_platform.values())
            if unit["verificationState"] == "unverified":
                if unit_records_for_verification:
                    errors.append(f"{unit_id}: unverified unit must not carry verification records")
            elif not unit_records_for_verification:
                errors.append(f"{unit_id}: verification record missing for non-unverified state")
            else:
                latest_check = max(record["checkedDate"] for record in latest_records)
                if unit["verificationDate"] != latest_check:
                    errors.append(f"{unit_id}: verificationDate does not match the latest evidence")
                latest_results = {record["result"] for record in latest_records}
                if any(
                    record["result"] == "verification-expired"
                    or date.fromisoformat(record["expiresDate"]) < evaluation_date
                    for record in latest_records
                ):
                    aggregate_state = "verification-expired"
                elif "verification-failed" in latest_results:
                    aggregate_state = "verification-failed"
                elif latest_results == {"unsupported"}:
                    aggregate_state = "unsupported"
                elif latest_results == {"verified"}:
                    aggregate_state = "verified"
                else:
                    aggregate_state = "verified-with-limitations"
                if unit["verificationState"] != aggregate_state:
                    errors.append(
                        f"{unit_id}: verificationState does not match latest platform evidence "
                        f"({unit['verificationState']} != {aggregate_state})"
                    )
                if unit["contentStatus"] in {"acceptance-ready", "stable"} and "unsupported" in latest_results:
                    errors.append(f"{unit_id}: release-ready unit has an unsupported declared platform")
            if unit["verificationState"] in {"verified", "verified-with-limitations", "unsupported"}:
                covered = set(latest_by_platform)
                if covered != set(unit["platforms"]):
                    errors.append(f"{unit_id}: verification lacks evidence for every declared platform")
            if unit["lastReviewedDate"] and date.fromisoformat(unit["lastReviewedDate"]) > generated_date:
                errors.append(f"{unit_id}: lastReviewedDate is later than the catalog date")
            for source_ref in unit["sourceRefs"]:
                if date.fromisoformat(source_ref["reviewDate"]) > generated_date:
                    errors.append(f"{unit_id}: source reviewDate is later than the catalog date")
                if unit["contentStatus"] in {
                    "editorial-reviewed",
                    "verification",
                    "acceptance-ready",
                    "stable",
                } and source_ref["reviewConclusion"] not in {"approved", "approved-with-limitations"}:
                    errors.append(f"{unit_id}: reviewed content retains an unresolved source reference")
                if unit["contentStatus"] == "stable":
                    if source_ref["license"].strip().lower() in {"unknown", "pending", "tbd"}:
                        errors.append(f"{unit_id}: stable content retains an unresolved source license")
                    if source_ref["pinnedVersion"].strip().lower() in {"head", "latest", "main", "master"}:
                        errors.append(f"{unit_id}: stable content source is not pinned to a reviewable version")
            if unit["rights"] in {"cleared", "link-only"} and not unit["sourceRefs"]:
                errors.append(f"{unit_id}: {unit['rights']} rights require at least one source reference")

    parsed_units = []
    registered_content_pages: set[Path] = set()
    chapter_ids = [item.get("chapterId") for item in legacy if isinstance(item, dict)]
    for chapter_id in chapter_ids:
        page = root / f"{chapter_id}.html"
        if not page.is_file():
            errors.append(f"module chapter page missing: {page.name}")
            continue
        registered_content_pages.add(page.resolve())
        page_units, summaries, unregistered_sections, _, unexpected_elements = parse_content_units(page)
        if summaries != ["summary"]:
            errors.append(f"{page.name}: expected exactly one #summary chapter summary")
        if unregistered_sections:
            errors.append(f"{page.name}: unregistered numbered sections: {unregistered_sections}")
        if unexpected_elements:
            errors.append(f"{page.name}: data-unit-id appears on non-section elements: {unexpected_elements}")
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
        prompt_units, _, _, unregistered_cards, unexpected_elements = parse_content_units(prompt_page)
        if unregistered_cards:
            errors.append(f"prompts.html: unregistered prompt cards: {unregistered_cards}")
        if unexpected_elements:
            errors.append(f"prompts.html: data-unit-id appears on non-section elements: {unexpected_elements}")
        visible_taxonomy = prompt_taxonomy_labels(prompt_page)
        collection_titles = {item["key"]: item["title"] for item in registry["collections"]}
        task_titles = {item["key"]: item["title"] for item in registry["taskTypes"]}
        collection_positions: dict[str, int] = {}
        for unit in prompt_units:
            record = records_by_id.get(unit.get("id"), {})
            collections = record.get("collectionKeys") or ["unregistered"]
            primary_collection = collections[0]
            expected_labels = (
                "、".join(collection_titles.get(key, key) for key in collections),
                task_titles.get(record.get("taskKey")),
            )
            if record.get("contentStatus") != "retired" and visible_taxonomy.get(unit.get("id")) != expected_labels:
                errors.append(f"{unit.get('id')}: visible prompt taxonomy differs from the module catalog")
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
        outside_units, _, _, _, unexpected_elements = parse_content_units(page)
        if outside_units or unexpected_elements:
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
        for field in (
            "title",
            "kind",
            "chapterId",
            "order",
            "publicPath",
            "contentStatus",
            "verificationState",
        ):
            if record.get(field) != parsed.get(field):
                errors.append(
                    f"{parsed.get('id')}: {field} differs between registry and HTML "
                    f"({record.get(field)!r} != {parsed.get(field)!r})"
                )
        if record.get("sourceAnchor") != parsed.get("anchor"):
            errors.append(f"{parsed.get('id')}: sourceAnchor differs from HTML anchor")
        if record.get("kind") == "prompt-card":
            for field in ("collectionKeys", "taskKey"):
                if record.get(field) != parsed.get(field):
                    errors.append(f"{parsed.get('id')}: {field} differs between registry and HTML metadata")
            if (
                parsed.get("visibleStatus") != record.get("contentStatus")
                or parsed.get("visibleStatusLabel") != STATUS_ZH.get(record.get("contentStatus"))
            ):
                errors.append(f"{parsed.get('id')}: visible prompt status differs from the module catalog")
        if record.get("contentStatus") == "retired":
            if (
                parsed.get("visibleStatus") != "retired"
                or parsed.get("visibleStatusLabel") != STATUS_ZH["retired"]
                or not parsed.get("retirementNotice")
            ):
                errors.append(f"{parsed.get('id')}: retired unit is missing its visible retirement tombstone")
        elif parsed.get("retirementNotice"):
            errors.append(f"{parsed.get('id')}: active unit contains a retirement tombstone")
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
    if set(checksum) != {archive.name}:
        errors.append("ZIP checksum file must contain exactly the archive entry")
    if checksum.get(archive.name) != sha256(archive.read_bytes()):
        errors.append("ZIP external checksum mismatch")

    prefix = "codex-tutorial-cn/"
    expected_payload_paths = {
        relative
        for relative in managed_public_paths(root, chapter_config)
        if relative not in {"404.html", "README.md", "robots.txt"}
        and not relative.startswith("deploy/")
    }
    try:
        with zipfile.ZipFile(archive) as package:
            infos = package.infolist()
            names = [info.filename for info in infos]
            can_extract = True
            if len(infos) > 512:
                errors.append("ZIP contains too many members")
                can_extract = False
            if len(names) != len(set(names)):
                errors.append("ZIP contains duplicate paths")
                can_extract = False
            portable_keys = []
            expanded_size = 0
            for info in infos:
                name = info.filename
                portable_key = portable_archive_path_key(name.rstrip("/"))
                if portable_key is None:
                    errors.append(f"ZIP has unsafe path: {name}")
                    can_extract = False
                else:
                    portable_keys.append(portable_key)
                if not name.startswith(prefix) or not safe_relative(name.rstrip("/")):
                    errors.append(f"ZIP has path outside the package root: {name}")
                    can_extract = False
                if info.is_dir():
                    errors.append(f"ZIP contains an unexpected directory entry: {name}")
                    can_extract = False
                unix_mode = info.external_attr >> 16
                file_type = stat.S_IFMT(unix_mode)
                if info.create_system == 3 and file_type not in {0, stat.S_IFREG}:
                    errors.append(f"ZIP contains a non-regular file: {name}")
                    can_extract = False
                if info.compress_type != zipfile.ZIP_STORED:
                    errors.append(f"ZIP member is not stored reproducibly: {name}")
                    can_extract = False
                if info.flag_bits & 0x1:
                    errors.append(f"ZIP contains an encrypted member: {name}")
                    can_extract = False
                if info.file_size > 20 * 1024 * 1024:
                    errors.append(f"ZIP member exceeds the 20 MiB limit: {name}")
                    can_extract = False
                expanded_size += info.file_size
            if len(portable_keys) != len(set(portable_keys)):
                errors.append("ZIP contains paths that collide on supported filesystems")
                can_extract = False
            if expanded_size > 100 * 1024 * 1024:
                errors.append("ZIP expanded payload exceeds the 100 MiB limit")
                can_extract = False
            files = {
                name[len(prefix):]
                for name in names
                if name.startswith(prefix) and not name.endswith("/")
            }
            manifest = json_loads_strict(package.read(prefix + "manifest.json").decode("utf-8"))
            sums = checksum_records(package.read(prefix + "SHA256SUMS.txt").decode("utf-8"))
            payload_paths = files - {"manifest.json", "SHA256SUMS.txt"}
            if payload_paths != expected_payload_paths:
                errors.append(
                    "ZIP payload differs from the authoritative offline file set "
                    f"(missing: {sorted(expected_payload_paths - payload_paths)}; "
                    f"extra: {sorted(payload_paths - expected_payload_paths)})"
                )
            expected_identity = {
                "schemaVersion": "1.0.0",
                "artifact": "codex-tutorial-cn-offline",
                "version": version,
                "status": json_loads_strict((root / "registry/modules-v1.json").read_text(encoding="utf-8"))["status"],
                "generatedDate": chapter_config["site"]["date"],
                "entry": "index.html",
            }
            for field, expected in expected_identity.items():
                if manifest.get(field) != expected:
                    errors.append(f"offline manifest {field} differs from the release identity")
            records = manifest.get("files")
            if not isinstance(records, list):
                errors.append("offline manifest files must be an array")
                records = []
            declared_list = [record.get("path") for record in records if isinstance(record, dict)]
            if len(declared_list) != len(records):
                errors.append("offline manifest contains a non-object file record")
            if len(declared_list) != len(set(declared_list)):
                errors.append("offline manifest contains duplicate paths")
            declared = set(declared_list)
            if declared != payload_paths or set(sums) != payload_paths:
                errors.append("manifest/checksum file set differs from ZIP payload")
            for record in records:
                relative = record.get("path")
                if not isinstance(relative, str) or not safe_relative(relative) or relative not in payload_paths:
                    continue
                payload = package.read(prefix + relative)
                digest = sha256(payload)
                if (
                    record.get("size") != len(payload)
                    or record.get("sha256") != digest
                    or sums.get(relative) != digest
                ):
                    errors.append(f"manifest/checksum mismatch: {relative}")
            online_index = (root / "index.html").read_text(encoding="utf-8")
            online_download = (
                f'<a class="btn ghost" href="downloads/{archive.name}" download>'
                '下载离线版（ZIP）</a>'
            )
            offline_marker = '<span class="btn ghost" aria-disabled="true">当前已是离线版</span>'
            if online_index.count(online_download) != 1:
                errors.append("online index does not contain the canonical offline download action")
            else:
                expected_index = online_index.replace(online_download, offline_marker, 1).encode("utf-8")
                if package.read(prefix + "index.html") != expected_index:
                    errors.append("offline index differs from the deterministic offline projection")
            if can_extract:
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
                    for relative in sorted(payload_paths - {"index.html"}):
                        online_path = root.joinpath(*relative.split("/"))
                        offline_path = package_root.joinpath(*relative.split("/"))
                        if not online_path.is_file() or online_path.read_bytes() != offline_path.read_bytes():
                            errors.append(f"{relative}: offline file differs from online artifact")
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

    try:
        config = json_loads_strict((ROOT / "src/chapters.json").read_text(encoding="utf-8"))
    except Exception as error:
        print(f"[ERROR] chapter config cannot be read: {error}")
        return 1
    errors, warnings = [], []
    errors.extend(check_repository_tree(ROOT, config))
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
