type PackagePillProps = {
  name: string;
  version?: string | null;
};

export function PackagePill({ name, version }: PackagePillProps) {
  return (
    <a
      className="chip chip--package"
      href={`/packages?q=${encodeURIComponent(name)}`}
      title={version ? `${name} ${version}` : name}
    >
      {name}
      {version ? <span className="muted">{version}</span> : null}
    </a>
  );
}
