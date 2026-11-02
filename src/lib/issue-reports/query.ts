// Receives PostgreSQL's canonical tsquery text, never raw user syntax.
export type QueryNode =
  | { kind: 'term'; text: string }
  | { kind: 'not'; child: QueryNode }
  | { kind: 'and' | 'or' | 'phrase'; left: QueryNode; right: QueryNode; distance?: number };

type Token = { kind: 'term' | 'not' | 'and' | 'or' | 'phrase' | '(' | ')'; text: string; distance?: number };
function tokenize(source: string): Token[] {
  const result: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const start = i;
    const char = source[i++];
    if (char === "'") {
      let closed = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i++] === "'") {
          if (source[i] === "'") { i++; continue; }
          closed = true; break;
        }
      }
      if (!closed) throw new Error('Unclosed canonical tsquery term');
      if (source[i] === ':') {
        i++;
        const suffixStart = i;
        while (i < source.length && /[A-Da-d*]/.test(source[i])) i++;
        if (suffixStart === i) throw new Error('Invalid canonical term suffix');
      }
      result.push({kind:'term',text:source.slice(start,i)});
      continue;
    }
    if (char === '(' || char === ')') { result.push({kind:char,text:char}); continue; }
    const kind = ({'!':'not','&':'and','|':'or'} as const)[char as '!'|'&'|'|'];
    if (kind) { result.push({kind,text:char}); continue; }
    if (char === '<') {
      const close = source.indexOf('>',i);
      const inner = source.slice(i,close);
      if (close < 0 || !/^(?:-|\d+)$/.test(inner)) throw new Error('Invalid canonical phrase operator');
      const distance = inner === '-' ? 1 : Number(inner);
      if (distance < 0 || distance > 16384) throw new Error('Invalid canonical phrase distance');
      i = close + 1;
      result.push({kind:'phrase',text:source.slice(start,i),distance});
      continue;
    }
    throw new Error(`Unexpected canonical tsquery token at ${start}`);
  }
  return result;
}

export function parseCanonicalQuery(source: string): QueryNode | null {
  const tokens = tokenize(source);
  if (!tokens.length) return null;
  let cursor = 0;
  function unary(depth: number): QueryNode {
    if (depth > 256) throw new Error('Canonical query is too deep');
    const token = tokens[cursor++];
    if (!token) throw new Error('Missing canonical query operand');
    if (token.kind === 'term') return {kind:'term',text:token.text};
    if (token.kind === 'not') return {kind:'not',child:unary(depth+1)};
    if (token.kind === '(') {
      const node = expression(0,depth+1);
      if (tokens[cursor++]?.kind !== ')') throw new Error('Missing canonical query closing parenthesis');
      return node;
    }
    throw new Error('Invalid canonical query operand');
  }
  function expression(minPrecedence: number, depth: number): QueryNode {
    let node = unary(depth);
    while (cursor < tokens.length) {
      const token = tokens[cursor];
      const precedence = token.kind === 'or' ? 1 : token.kind === 'and' ? 2 : token.kind === 'phrase' ? 3 : -1;
      if (precedence < minPrecedence) break;
      cursor++;
      const right = expression(precedence+1,depth+1);
      node = {kind:token.kind as 'and'|'or'|'phrase',left:node,right,...(token.kind === 'phrase' ? {distance:token.distance}: {})};
    }
    return node;
  }
  const node = expression(0,0);
  if (cursor !== tokens.length) throw new Error('Unexpected canonical query tail');
  return node;
}

export function serializeQuery(node: QueryNode): string {
  if (node.kind === 'term') return node.text;
  if (node.kind === 'not') return `!(${serializeQuery(node.child)})`;
  const operator = node.kind === 'and' ? '&' : node.kind === 'or' ? '|' : `<${node.distance}>`;
  return `(${serializeQuery(node.left)} ${operator} ${serializeQuery(node.right)})`;
}

// null means TRUE: omit the index predicate. Removing NOT is deliberately broad.
export function candidateQuery(node: QueryNode): QueryNode | null {
  if (node.kind === 'term') return node;
  if (node.kind === 'not') return null;
  const left = candidateQuery(node.left);
  const right = candidateQuery(node.right);
  if (node.kind === 'or') return left === null || right === null ? null : {kind:'or',left,right};
  return left === null ? right : right === null ? left : {kind:'and',left,right};
}

// bind must return a SQL parameter, not interpolate text. Identifiers are internal constants.
export function compileFieldMatch(node: QueryNode, bind: (value: string)=>string, vector = 'enriched_search_vector', fields = 'enriched_field_vectors'): string {
  if (node.kind === 'term') return `(${vector} @@ ${bind(node.text)}::tsquery)`;
  if (node.kind === 'phrase') return `EXISTS (SELECT 1 FROM unnest(${fields}) AS f(vector) WHERE f.vector @@ ${bind(serializeQuery(node))}::tsquery)`;
  if (node.kind === 'not') return `(NOT (${compileFieldMatch(node.child,bind,vector,fields)}))`;
  return `(${compileFieldMatch(node.left,bind,vector,fields)} ${node.kind === 'and' ? 'AND':'OR'} ${compileFieldMatch(node.right,bind,vector,fields)})`;
}


export function validatePhraseSpans(node: QueryNode): number {
  if (node.kind === "term") return 0;
  if (node.kind === "not") return validatePhraseSpans(node.child);
  const left = validatePhraseSpans(node.left);
  const right = validatePhraseSpans(node.right);
  const span = node.kind === "phrase" ? left + (node.distance ?? 1) + right : Math.max(left, right);
  if (span > 128) throw new Error("Quoted phrases may span at most 128 word positions.");
  return span;
}
