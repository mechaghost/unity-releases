import {
  classifyImpact,
  classifyRisk,
  riskReasons,
  type ImpactKind,
  type RiskLevel
} from "../classification";
import { sha256 } from "./hash";

export type StoredReleaseNoteForReclassification = {
  version: string;
  section: string;
  area: string | null;
  platforms: string[];
  impactKind: string;
  riskLevel: string;
  riskReasons: string[];
  body: string;
  issueIds: string[];
  issueLinks: Array<{ id: string; url: string }>;
  packageNames: string[];
  sourceUrl: string;
  sourceOrder: number;
  normalizedSha256: string;
};

export function reclassifyStoredReleaseNote(
  note: StoredReleaseNoteForReclassification
) {
  // The parser classifies the original bullet before stripping its
  // leading `Area:` label for storage. Reconstruct that classification
  // input so replaying a stored row produces the same result as a fresh
  // parse (for example, `Licensing:` is an install-risk signal).
  const classificationBody = note.area
    ? `${note.area}: ${note.body}`
    : note.body;
  const impactKind = classifyImpact(note.section, classificationBody);
  const riskLevel = classifyRisk(
    note.section,
    impactKind,
    classificationBody
  );
  const reasons = riskReasons(note.section, impactKind, note.platforms);
  const normalizedSha256 = releaseNoteClassificationHash({
    ...note,
    impactKind,
    riskLevel,
    riskReasons: reasons
  });
  return {
    impactKind,
    riskLevel,
    riskReasons: reasons,
    normalizedSha256,
    changed:
      impactKind !== note.impactKind ||
      riskLevel !== note.riskLevel ||
      !sameStrings(reasons, note.riskReasons) ||
      normalizedSha256 !== note.normalizedSha256
  };
}

function releaseNoteClassificationHash(
  note: Omit<StoredReleaseNoteForReclassification, "normalizedSha256"> & {
    impactKind: ImpactKind;
    riskLevel: RiskLevel;
  }
) {
  return sha256({
    version: note.version,
    section: note.section,
    area: note.area,
    platforms: note.platforms,
    impactKind: note.impactKind,
    riskLevel: note.riskLevel,
    riskReasons: note.riskReasons,
    body: note.body,
    issueIds: note.issueIds,
    issueLinks: note.issueLinks,
    packageNames: note.packageNames,
    sourceUrl: note.sourceUrl,
    sourceOrder: note.sourceOrder
  });
}

function sameStrings(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
