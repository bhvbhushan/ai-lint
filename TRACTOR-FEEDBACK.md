# Tractor Feedback: Using Tractor as a Linting Backend for VibeCop

This document captures observations, friction points, and feature requests
encountered while porting VibeCop's 22 AST-based linting rules to Tractor XPath queries.

Overall impression: Tractor is **extremely powerful** for this use case. The XPath
query language maps naturally to code pattern detection, and the `check --rules`
workflow is almost exactly what a tool like VibeCop needs. What took 100-400 lines
of imperative TypeScript per rule is expressible in 3-10 lines of XPath.

---

## Critical Issues

### 1. TSX/JSX Parsing is Broken

**Severity: Blocker for React codebases**

TSX/JSX elements are misparsed as TypeScript type assertions. This makes it
impossible to write rules for React-specific patterns like `dangerouslySetInnerHTML`.

```bash
echo 'const x = <div className="test">hello</div>;' | tractor -l tsx
```

Produces:
```xml
<ERROR>
  const <type>x</type> = <type_arguments>< <type>div</type></type_arguments>
  <type>className</type> = <string>"test"</string>
  ...
</ERROR>
```

Expected: proper `jsx_element` / `jsx_self_closing_element` nodes.

**Impact**: Blocks 2 VibeCop rules (`dangerous-inner-html`, `god-component`) and
any future React/JSX-specific rules.

### 2. `tractor run` Hangs on File-Based Configs

**Severity: Major**

`tractor run config.yaml` appears to hang indefinitely when the config references
files (vs. inline data). Tested with various path styles (relative, absolute, glob).
The same queries work fine via `tractor check file --rules rules.yaml`.

```bash
# This hangs:
tractor run rules.yaml  # where rules.yaml has files: ["src/bad-code.ts"]

# This works:
tractor check "src/bad-code.ts" --rules rules.yaml
```

This is confusing because the `tractor run` help suggests it should work for
check operations. The YAML format for `run` configs is also different from `check --rules`,
which adds to the confusion.

**Suggestion**: Either fix `tractor run` for check operations, or document clearly
that `check --rules` is the intended way to run batch lint rules.

### 3. `tractor run` and `tractor check --rules` Use Different Config Formats

**Severity: Confusing**

`tractor run` expects:
```yaml
check:
  files: [...]
  rules:
    - id: ...
      xpath: ...
```

`tractor check --rules` expects:
```yaml
rules:
  - id: ...
    xpath: ...
```

The file targeting is done via CLI args for `check` but via config for `run`.
Having two incompatible YAML schemas for the same concept is a documentation and
usability burden.

**Suggestion**: Unify the format. Ideally `tractor run` should accept `check --rules`
format too, or the formats should be documented side-by-side with clear
"use this when..." guidance.

---

## Feature Requests

### 4. Line Counting / Source Length Functions

**Severity: High (blocks important rules)**

VibeCop's `god-function` detector checks function body line count (>50 lines = warning,
>100 = error). There's no XPath function to count lines in a node's source text.

Desired:
```xpath
//function[line-count(body) > 50]
```

Or via string functions:
```xpath
//function[count-lines(.) > 50]
```

Currently, `string-length()` exists in XPath 3.1 but I couldn't find a way to
count newlines within matched source text. This is the #1 missing feature for linting.

### 5. Cyclomatic Complexity Calculation

**Severity: Medium**

VibeCop counts branching constructs (if/else/for/while/switch/ternary + logical
operators) recursively from a function node. This could potentially be expressed as:

```xpath
//function[
  count(.//if_statement) + count(.//for_statement) + count(.//while_statement) 
  + count(.//switch_statement) + count(.//ternary_expression) > 15
]
```

This actually might already work? I didn't test it because the tree element names
for all these constructs weren't obvious. **A "complexity()" helper function** or
documentation of standard branching node names across languages would be very useful.

### 6. Node Text Equality Comparison Between Siblings

**Severity: Medium**

VibeCop's `dead-code-path` detector compares if/else branch contents to detect
identical branches. VibeCop's `trivial-assertion` compares `expect(X).toBe(X)`
where both X are the same literal.

Desired:
```xpath
//if_statement[body = else/body]
```

Or for trivial assertions:
```xpath
//call[
  function/member[property='toBe']
][
  arguments/arguments/*[1] = function/member/object/arguments/arguments/*[1]
]
```

This kind of "match two subtrees by text content" is common in linting but tricky
in pure XPath.

### 7. Parent/Ancestor Axis for Context Checks

**Severity: Medium**

VibeCop's `unchecked-db-result` detector checks if an await expression's result is
assigned to a variable (fire-and-forget detection). This needs ancestor-axis queries:

```xpath
//await[not(ancestor::variable)][.//call[function/member/property='insert']]
```

I'm not sure if Tractor supports `ancestor::` axis. If it does, this wasn't obvious
from the documentation.

### 8. File-Level Aggregation / Threshold Queries

**Severity: Medium**

Several VibeCop rules need per-file counts exceeding a threshold:
- `excessive-any`: files with >3 `any` type annotations
- `excessive-comment-ratio`: files where comments exceed 50% of lines
- `over-mocking`: test files where mock count exceeds assertion count

Desired:
```xpath
(: Report if file has more than 3 'any' types :)
//program[count(.//predefined_type[.='any']) > 3]
```

This might already work if `//program` selects the file root. Worth documenting
if so.

### 9. Negative Lookahead / "Not Followed By" Patterns

**Severity: Medium**

VibeCop's `unbounded-query` detector finds `findMany()` calls that are NOT followed
by `.take()` or `.limit()`. This "method call without chained safety" pattern is
common in linting.

Desired:
```xpath
//call[function/member/property='findMany'][not(.//member/property='take')]
```

This might be expressible with `not()` but the chaining semantics (`.findMany().take()` 
vs `.findMany()` standalone) are unclear in the tree model.

---

## Usability / Documentation

### 10. TypeScript Tree Structure is Not Semantically Clean

**Severity: Low-Medium**

The TypeScript semantic tree has some rough edges:

- `<ref/>` appears in many places but it's unclear what it represents
- `<type>` is overloaded — used for variable names, type annotations, and identifiers
- `<bool>` for `true`/`false` is good, but not all boolean-like values are tagged
- `function/member/object` vs `function/member/property` naming is intuitive but
  discovering these paths requires trial-and-error with `tractor file.ts`

**Suggestion**: A "TypeScript tree reference" page showing the semantic tree for
common patterns (function calls, member access, assignments, imports, etc.) would
dramatically speed up rule authoring. The `-v schema` view helps but doesn't show
the full picture.

### 11. `--rules` YAML Format Undocumented

**Severity: Medium**

The `check --rules` flag accepts YAML but the expected format (`rules: [{id, xpath, reason, severity}]`)
isn't documented in `--help`. I had to discover it through error messages:

```
invalid type: sequence, expected struct RulesConfig
```

...which told me to wrap rules in a `rules:` key. The `language`, `expect-valid`,
and `expect-invalid` fields were discovered by analogy with CLI flags.

**Suggestion**: Add a `--rules` format example to `tractor check --help` or document
it in a rules authoring guide.

### 12. Discovering Tree Node Names is Trial-and-Error

**Severity: Low**

Writing XPath rules requires knowing the exact element names in Tractor's semantic
tree. Currently the workflow is:

1. Write example code to a temp file
2. Run `tractor file.ts` to see the tree
3. Read the XML to find element names
4. Write the XPath
5. Test and iterate

The `-v schema` view helps, but only for already-matched nodes. A searchable
reference of "all element names for language X" would be valuable.

**Suggestion**: `tractor --list-elements typescript` or a web reference.

### 13. No Way to Exclude Files in `check --rules`

**Severity: Medium**

The `check --rules` workflow targets files via CLI glob, but there's no way to
exclude patterns (test files, generated files, vendor directories). The `run`
config format has `exclude:` but `check --rules` doesn't.

For VibeCop, most rules skip test files. Currently the only option is to carefully
craft the glob to exclude them, which is fragile.

**Suggestion**: Add `--exclude` flag to `tractor check`, or support `exclude:` in
the `--rules` YAML.

### 14. Error Output on Exit Code 1

**Severity: Cosmetic / Minor**

When `tractor check` finds violations, it exits with code 1 and writes JSON to
**stdout**. This is correct behavior for CI, but the JSON `"success": false` is
misleading — the tool succeeded, it just found issues. Consider `"violations_found": true`
or similar to distinguish "tractor failed" from "tractor found problems".

---

## Things That Work Great

To be fair, here's what impressed me:

- **XPath is the right abstraction**: Code patterns map naturally to tree queries.
  `//call[function/member[object='console'][property='log']]` is readable even to
  someone who's never seen XPath before.

- **`check --rules` with YAML**: The batch rules format is almost exactly what a
  linting tool needs. Adding `expect-valid` / `expect-invalid` inline examples
  for self-testing rules is brilliant.

- **JSON output with `rule_id`**: The `-f json -v "reason,severity,file,line,column"`
  output is directly mappable to any linting framework's finding format.

- **`-f gcc` and `-f github`**: Native CI integration formats mean VibeCop wouldn't
  even need a wrapper for many use cases.

- **Speed**: Parsing and querying a TypeScript file with 11 rules completes in
  under a second. This is competitive with ast-grep.

- **Multi-language with one syntax**: The same XPath works for JS, TS, and Python
  (with different node names). This is a significant advantage over ast-grep where
  patterns are language-specific.

---

## Summary: What Would Make Tractor a Drop-In Backend for VibeCop

| Priority | Feature | Rules Unblocked |
|----------|---------|-----------------|
| P0 | Fix TSX/JSX parsing | `dangerous-inner-html`, `god-component` |
| P0 | Document `check --rules` YAML format | All rules (usability) |
| P1 | Line counting function | `god-function` (full), `excessive-comment-ratio` |
| P1 | File exclude in `check --rules` | All rules (test file skipping) |
| P1 | Unify `run` / `check --rules` config | Usability |
| P2 | Cyclomatic complexity helper or docs | `god-function` (full) |
| P2 | Node text comparison | `dead-code-path`, `trivial-assertion` |
| P2 | Per-file aggregation docs | `excessive-any`, `over-mocking` |
| P3 | Tree node reference docs | All rules (authoring speed) |
