"""Find the end of a JS expression that starts at a given index (a literal, arrow function or call), stopping at the
statement end (';' or newline at depth 0). Handles strings, template literals (with ${...}), regex-free data."""
def expr_end(a, i):
    depth = 0; n = len(a); j = i
    while j < n:
        c = a[j]
        if c in '\'"':
            q = c; j += 1
            while j < n and a[j] != q:
                if a[j] == '\\': j += 1
                j += 1
        elif c == '`':
            j += 1; tdepth = 0
            while j < n:
                if a[j] == '\\': j += 2; continue
                if a[j] == '`' and tdepth == 0: break
                if a[j] == '$' and j + 1 < n and a[j + 1] == '{': tdepth += 1; j += 2; continue
                if a[j] == '}' and tdepth: tdepth -= 1
                j += 1
        elif c in '([{': depth += 1
        elif c in ')]}':
            depth -= 1
            if depth < 0: return j
        elif depth == 0 and c in ';\n': return j
        elif depth == 0 and c == ',' : return j
        j += 1
    return j
def const_span(a, name):
    """(start of value, end of value) of `const NAME=` (exactly one declaration)."""
    key = 'const ' + name + '='
    k = a.find(key); assert k >= 0 and a.find(key, k + 1) < 0, ('const not unique/found', name, a.count(key))
    s = k + len(key); e = expr_end(a, s)
    return s, e
