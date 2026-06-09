import type { AtlasView, OutlineNode } from "../adapters/atlas";

function Node({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OutlineNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-testid={`outline-node-${node.id}`}
        className={`outline-node depth-${depth} kind-${node.kind}${node.id === selectedId ? " selected" : ""}`}
        aria-pressed={node.id === selectedId}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        <span className="outline-kind">{node.kind}</span> {node.title}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AtlasOutline({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="atlas-outline" data-testid="atlas-outline" aria-label="Atlas outline">
      <ul>
        {view.outline.map((n) => (
          <Node key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </ul>
    </nav>
  );
}
