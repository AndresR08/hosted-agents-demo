import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Button,
  Input,
  Spinner,
} from "@fluentui/react-components";
import {
  ChevronDownRegular,
  ChevronRightRegular,
  CheckmarkRegular,
  CopyRegular,
  DismissRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import type { Provenance } from "@/services/contracts";

type SectionId = "inbound" | "backend" | "outbound" | "on-error";
const SECTION_IDS: SectionId[] = ["inbound", "backend", "outbound", "on-error"];

interface PolicyRow {
  n: number;
  text: string;
  section: SectionId | null;
}

/**
 * Fallback content for Simulation mode and for Live mode if the broker call
 * fails — the real inbound policy from hosted-agent-policy.xml, reproduced
 * verbatim (all 31 lines). In Live mode this is never shown as long as
 * `getPolicyDocument()` succeeds — see the fetch effect below.
 */
const FALLBACK_XML = [
  "<policies>",
  "  <inbound>",
  "    <base />",
  "    <!-- Get managed identity token for Foundry Responses API -->",
  '    <authentication-managed-identity resource="https://ai.azure.com" output-token-variable-name="managed-id-access-token" ignore-error="false" />',
  "",
  "    <!-- Set bearer token in Authorization header -->",
  '    <set-header name="Authorization" exists-action="override">',
  '      <value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>',
  "    </set-header>",
  "",
  "    <!-- Force Content-Type header -->",
  '    <set-header name="Content-Type" exists-action="override">',
  "      <value>application/json</value>",
  "    </set-header>",
  "",
  "    <!-- Force Foundry-Features header for preview access -->",
  '    <set-header name="Foundry-Features" exists-action="override">',
  "      <value>HostedAgents=V1Preview</value>",
  "    </set-header>",
  "  </inbound>",
  "  <backend>",
  "    <base />",
  "  </backend>",
  "  <outbound>",
  "    <base />",
  "  </outbound>",
  "  <on-error>",
  "    <base />",
  "  </on-error>",
  "</policies>",
].join("\n");

/** Splits raw policy XML into numbered rows and tags each with its enclosing top-level section, by plain substring matching — not a general XML parser, deliberately, for a document this small and well-known in shape. Works the same whether the XML came from the live ARM fetch (tabs, no blank lines) or the static fallback (spaces, blank lines) — see AZURE_INTEGRATION_REPORT.md. */
function parsePolicyRows(xml: string): PolicyRow[] {
  const lines = xml.replace(/\r\n/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  let current: SectionId | null = null;
  return lines.map((text, i) => {
    const trimmed = text.trim();
    const openMatch = /^<(inbound|backend|outbound|on-error)>$/.exec(trimmed);
    const closeMatch = /^<\/(inbound|backend|outbound|on-error)>$/.exec(trimmed);
    let section = current;
    if (openMatch) {
      current = openMatch[1] as SectionId;
      section = current;
    } else if (closeMatch) {
      section = current;
      current = null;
    }
    return { n: i + 1, text, section };
  });
}

function computeSectionRanges(rows: PolicyRow[]): Record<SectionId, { openLine: number; closeLine: number }> {
  const ranges = {} as Record<SectionId, { openLine: number; closeLine: number }>;
  for (const id of SECTION_IDS) {
    const rowsInSection = rows.filter((r) => r.section === id);
    ranges[id] = {
      openLine: rowsInSection[0]?.n ?? 0,
      closeLine: rowsInSection[rowsInSection.length - 1]?.n ?? 0,
    };
  }
  return ranges;
}

const HIGHLIGHT_TOKEN_RE = /<!--[\s\S]*?-->|<\/?[\w-]+|[\w-]+="[^"]*"|\/?>|\s+|[^<>\s]+/g;

/** Small, hand-rolled XML highlighter for this one known document shape — not a general parser, and no new dependency for a ~31-line file. */
function highlightXmlLine(text: string, query: string): ReactNode {
  if (text.length === 0) return null;

  if (query.trim().length > 0) {
    return highlightSearchMatches(text, query);
  }

  const tokens = text.match(HIGHLIGHT_TOKEN_RE) ?? [];
  return tokens.map((token, i) => {
    if (token.startsWith("<!--")) {
      return (
        <span key={i} className="italic text-ink-muted">
          {token}
        </span>
      );
    }
    if (/^<\/?[\w-]+$/.test(token) || /^\/?>$/.test(token)) {
      return (
        <span key={i} className="text-accent">
          {token}
        </span>
      );
    }
    const attrMatch = /^([\w-]+)(="[^"]*")$/.exec(token);
    if (attrMatch) {
      return (
        <span key={i}>
          <span className="font-medium text-ink">{attrMatch[1]}</span>
          {/* Syntax highlighting is its own axis; it does not get the 401 green. */}
          <span className="text-accent">{attrMatch[2]}</span>
        </span>
      );
    }
    return (
      <span key={i} className="text-ink">
        {token}
      </span>
    );
  });
}

function highlightSearchMatches(text: string, query: string): ReactNode {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at === -1) {
      parts.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    }
    if (at > i) parts.push(<span key={key++}>{text.slice(i, at)}</span>);
    parts.push(
      <mark key={key++} className="rounded-sm bg-accent/30 text-ink">
        {text.slice(at, at + query.length)}
      </mark>,
    );
    i = at + query.length;
  }
  return parts;
}

function countMatches(rows: PolicyRow[], query: string): number {
  if (query.trim().length === 0) return 0;
  const needle = query.toLowerCase();
  return rows.reduce((sum, row) => {
    const lower = row.text.toLowerCase();
    let count = 0;
    let i = 0;
    while (true) {
      const at = lower.indexOf(needle, i);
      if (at === -1) break;
      count += 1;
      i = at + needle.length;
    }
    return sum + count;
  }, 0);
}

/**
 * ③ Access Control's "Show the live policy" — a VS-Code-style viewer:
 * line numbers, section fold/collapse, in-place search highlighting, copy,
 * monospace, real XML syntax colouring (see highlightXmlLine above).
 *
 * Live mode fetches the actual running policy from ARM
 * (`getPolicyDocument`, routes/policy.ts on the broker) when the dialog
 * opens — not a copy of the .xml file in the repo. Simulation mode, and
 * Live mode if that fetch fails, fall back to FALLBACK_XML, which is that
 * same file's content reproduced verbatim.
 */
export function PolicyViewerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);

  const [xml, setXml] = useState(FALLBACK_XML);
  const [provenance, setProvenance] = useState<Provenance>({ band: "illustrative" });
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<SectionId, boolean>>({
    inbound: false,
    backend: true,
    outbound: true,
    "on-error": true,
  });
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode !== "live") {
      setXml(FALLBACK_XML);
      setProvenance({ band: "illustrative" });
      return;
    }
    setLoading(true);
    service
      .getPolicyDocument("hosted-agent-responses-api")
      .then((doc) => {
        setXml(doc.xml);
        setProvenance(doc.provenance);
      })
      .catch(() => {
        setXml(FALLBACK_XML);
        setProvenance({ band: "illustrative" });
      })
      .finally(() => setLoading(false));
  }, [open, mode, service]);

  const rows = useMemo(() => parsePolicyRows(xml), [xml]);
  const sectionRanges = useMemo(() => computeSectionRanges(rows), [rows]);

  // While actively searching, force open any section containing a match.
  const effectiveCollapsed = useMemo(() => {
    if (query.trim().length === 0) return collapsed;
    const needle = query.toLowerCase();
    const next = { ...collapsed };
    for (const row of rows) {
      if (row.section && row.text.toLowerCase().includes(needle)) {
        next[row.section] = false;
      }
    }
    return next;
  }, [collapsed, query, rows]);

  const visibleRows = useMemo(() => {
    const visible: { n: number; text: string; toggle?: SectionId; folded?: boolean }[] = [];
    for (const row of rows) {
      if (!row.section) {
        visible.push(row);
        continue;
      }
      const range = sectionRanges[row.section];
      const isOpenLine = row.n === range.openLine;
      if (effectiveCollapsed[row.section]) {
        if (isOpenLine) {
          const closeText = rows.find((r) => r.n === range.closeLine)?.text.trim() ?? "";
          visible.push({ n: row.n, text: `${row.text} … ${closeText}`, toggle: row.section, folded: true });
        }
        continue;
      }
      visible.push(isOpenLine ? { ...row, toggle: row.section, folded: false } : row);
    }
    return visible;
  }, [rows, sectionRanges, effectiveCollapsed]);

  const matchCount = useMemo(() => countMatches(rows, query), [rows, query]);

  function copyAll() {
    navigator.clipboard?.writeText(xml).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="!w-[900px] !max-w-[90vw]">
        <DialogBody className="!h-[78vh]">
          <DialogTitle
            action={
              <Button appearance="subtle" icon={<DismissRegular />} aria-label={t("settings.close")} onClick={onClose} />
            }
          >
            {t("accessControl.policyTitle")}
          </DialogTitle>
          <DialogContent className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <Input
                contentBefore={<SearchRegular fontSize={16} />}
                value={query}
                onChange={(_, data) => setQuery(data.value)}
                placeholder={t("accessControl.policyViewer.search")}
                className="flex-1"
              />
              {query.trim().length > 0 && (
                <span className="shrink-0 text-caption text-ink-muted">
                  {matchCount} {t("accessControl.policyViewer.matchesLabel")}
                </span>
              )}
              <Button
                appearance="subtle"
                size="small"
                icon={copied ? <CheckmarkRegular className="text-accent" /> : <CopyRegular />}
                onClick={copyAll}
              >
                {copied ? t("assistant.copied") : t("accessControl.policyViewer.copy")}
              </Button>
              {loading ? <Spinner size="tiny" /> : <ProvenanceBadge provenance={provenance} />}
            </div>

            <div className="scrollbar-subtle min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-border bg-illustrative-bg">
              <pre className="m-0 font-mono text-caption leading-relaxed">
                {visibleRows.map((row) => (
                  <div key={row.n} className="flex hover:bg-accent/5">
                    <span className="w-10 shrink-0 select-none border-r border-border px-2 text-right text-ink-muted">
                      {row.n}
                    </span>
                    {row.toggle ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsed((prev) => ({ ...prev, [row.toggle as SectionId]: !prev[row.toggle as SectionId] }))
                        }
                        className="flex flex-1 items-start gap-1 px-2 py-0.5 text-left hover:bg-accent/10"
                      >
                        {row.folded ? (
                          <ChevronRightRegular fontSize={14} className="mt-0.5 shrink-0 text-ink-muted" />
                        ) : (
                          <ChevronDownRegular fontSize={14} className="mt-0.5 shrink-0 text-ink-muted" />
                        )}
                        <span className="whitespace-pre">{highlightXmlLine(row.text, query)}</span>
                      </button>
                    ) : (
                      <span className="flex-1 whitespace-pre px-2 py-0.5 pl-[22px]">
                        {highlightXmlLine(row.text, query) ?? " "}
                      </span>
                    )}
                  </div>
                ))}
              </pre>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
