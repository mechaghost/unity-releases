export type UnityStream = "LTS" | "Update/Supported" | "beta" | "alpha" | "patch";

export type ParsedUnityVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  suffixChannel: string;
  suffixNumber: number;
  majorLine: string;
  minorLine: string;
  stream: UnityStream;
  isPrerelease: boolean;
};

const UNITY_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)([abfp])(\d+)$/;

const CHANNEL_SORT_WEIGHT: Record<string, number> = {
  a: 0,
  b: 1,
  f: 2,
  p: 3
};

export function parseUnityVersion(version: string): ParsedUnityVersion {
  const match = version.trim().match(UNITY_VERSION_RE);

  if (!match) {
    throw new Error(`Invalid Unity version: ${version}`);
  }

  const [, majorRaw, minorRaw, patchRaw, suffixChannel, suffixNumberRaw] = match;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);
  const suffixNumber = Number(suffixNumberRaw);

  return {
    raw: version.trim(),
    major,
    minor,
    patch,
    suffixChannel,
    suffixNumber,
    majorLine: String(major),
    minorLine: `${major}.${minor}`,
    stream: streamForChannel(suffixChannel, minor),
    isPrerelease: suffixChannel === "a" || suffixChannel === "b"
  };
}

export function isUnity6OrNewer(version: string): boolean {
  return parseUnityVersion(version).major >= 6000;
}

export function compareUnityVersions(a: string, b: string): number {
  const left = parseUnityVersion(a);
  const right = parseUnityVersion(b);

  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch ||
    CHANNEL_SORT_WEIGHT[left.suffixChannel] - CHANNEL_SORT_WEIGHT[right.suffixChannel] ||
    left.suffixNumber - right.suffixNumber
  );
}

function streamForChannel(channel: string, minor: number): UnityStream {
  if (channel === "a") {
    return "alpha";
  }

  if (channel === "b") {
    return "beta";
  }

  if (channel === "p") {
    return "patch";
  }

  return minor === 0 ? "LTS" : "Update/Supported";
}
