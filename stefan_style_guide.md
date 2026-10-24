# Stefan's Style Guide

A reference for how Stefan writes — in code, in project reports, and on portfolio pages.
Derived from reviewing `src/`, `docs/project_log.md`, and the live MRI segmentation portfolio page.
Update this document as new patterns are confirmed or corrected.

---

## Voice and Tone

**First person, honest, personal.** The writing sounds like someone explaining what they built and what happened — not a formal technical report.

Use "I" freely. Own surprises, mistakes, and things that didn't go as planned:

> *"I went in expecting the Transformer to dominate and left with a very different picture."*

> *"This was the result I found most interesting, and honestly the one I hadn't predicted going in."*

Express genuine curiosity:

> *"It's the one I'm most curious about."*

Acknowledge limitations directly rather than softening them:

> *"I'd need multiple seeds to be sure the 0.004 mean improvement is a real signal rather than noise, but the direction is consistent."*

Don't oversell. Don't undersell. Say what happened.

---

## Contractions

Use them sometimes in prose and sometimes not. The writing reads as spoken English, not formal academic writing.

- "don't", "it is", "I'd", "that's", "didn't", "doesn't", "what is", "there is", "it will"
- Avoiding contractions signals the wrong register

---

## Punctuation Preferences

### Em dashes — avoid in prose

No em dashes in running text, prose sentences, regular code comments, or docstring body text.

**Instead, use:**
- A new sentence: *"That is a real constraint."* (not *"— a real constraint"*)
- Parentheses for asides: *(a consumer GPU with 8 GB of VRAM)*
- A comma where it fits naturally
- A dash `-` in comments if truly needed, but a new sentence is better

**Em dashes are acceptable only in:** 
- Paper citation blockquotes: *Çiçek et al. 2016 — "3D U-Net: ..."*
- When the text looks and should seem like it was copied and pasted, so things like titles, document names or outside sources 

### Colons — use sparingly, avoid where possible

Colons are fine when genuinely introducing a list or table. Don't use them in flowing prose as a substitute for a new sentence or a comma.

OK to use:
- Before a markdown table that follows naturally
- In docstrings listing inputs (`Takes two inputs: / - g: ...`)
- In bold lead-in labels within engineering sections (*npy preprocessing cache* / explanation paragraph — not a colon after the label)

Avoid:
- Mid-sentence colons where a new sentence works just as well
- "The result is: X" patterns — just say "The result is X" or start a new sentence

### Semicolons

Rare to almost never. Two short sentences is almost always better than a semicolon joining them.

### Oxford comma

Use it. Commas in lists of three or more items include the final one before "and".

### Bullet points and lists

Short lists are fine as bullet points. But running prose is preferred when items flow naturally in sequence. Don't convert a paragraph into bullets just to make it scannable.

---

## Sentence Rhythm

Vary length, but avoid very short sentences of two, three, or four words. Fragments like "One variable." or "Small detail." read as affectations. They add rhythm in moderation but become gimmicky fast and Stefan doesn't lean on them.

The rhythm that works here is medium sentences for setup, longer sentences for analysis and nuance. End a section with something punchy if the point deserves it, but that means a full sentence with a subject and verb, not a two-word declaration.

Good short-ish:
> *"More parameters and global attention don't automatically mean better results."*

> *"ET was the region I expected to benefit most."*

Too short to use:
> *"One variable."*  
> *"Small detail."*  
> *"Everything else identical."*

Longer sentences carry the analytical weight. Don't chop them up unnecessarily. Starting sentences with "And" or "But" is fine and natural:

> *"And the pattern held across every model I trained."*

> *"But the gap between patch-level validation and full-volume evaluation is the textbook sign of memorising patch patterns rather than generalising."*

---

## Spelling

**British English somewhere, and at others American.** This is consistent across the portfolio page and docs.

| British | Not this |
|---------|----------|
| tumour | tumor |
| oedema | edema |
| behaviour | behavior |
| generalises | generalizes |
| memorising | memorizing |
| recognised | recognized |

---

## Numbers and Quantities

Dice scores reported to 3 decimal places: `0.884`, not `0.88` or `0.8840`.

Parameter counts in compact M form with 2 decimal places where meaningful: `22.66M`, `2.42M`, `62.19M`.

Training times approximated with tilde: `~7 hrs`, `~17 hrs`.

Multipliers with × symbol (no space): `26×`, `4×`, `2.7×`.

Data subsets shown as fraction: `150/1,251 cases`, `150 of 1,251`.

---

## Project Report Structure

### Overall shape

The exact sections vary by project type, but the underlying arc is consistent across all of them:

1. **Title + one-line description** — what the project is, stated plainly up front
2. **TL;DR** — the headline finding or result, before any detail. Front-loads the surprise if there is one
3. **The problem or question** — why this is worth doing, what makes it non-trivial
4. **Context and constraints** — the data source, tools, hardware, scope limitations, or whatever shaped the approach
5. **The work itself** — the analysis, methodology, or progression of steps, structured around what was discovered rather than what was done chronologically
6. **Results or findings** — the actual output, with honest framing of what they do and don't mean
7. **Non-obvious decisions** — the WHY behind choices that aren't self-explanatory
8. **What's next** — honest list of what's unfinished, what would change the conclusions, or what a continuation would look like

For an ML project the "work itself" is an architecture progression. For a SQL analytics project it might be a sequence of analytical questions, each answered with a query and a visualisation. For a data pipeline project it might be the design decisions in order of importance. The shape adapts but the principles stay the same.

### TL;DR section

Always present. Short. States the most surprising or useful result clearly and without hedging.

For an ML project: *"A 22M-parameter CNN outperformed a 62M-parameter Transformer. A 2.4M-parameter model then matched the Transformer at 26× fewer parameters."*

For a SQL analytics project it might be: *"Revenue growth in 2023 was entirely driven by a single product category. The rest of the catalogue was flat or declining."*

The TL;DR is the thing someone should walk away with even if they only read the first two paragraphs.

### Findings and results sections

Each finding or result block follows the same logic regardless of project type:

1. **State the finding** — one clear sentence, bolded if it's the headline
2. **Show the evidence** — a table, chart, or query result that backs it up
3. **Interpret it** — what does this actually mean? Why is it interesting or surprising?
4. **Honest caveat if needed** — what would change the conclusion, or what's uncertain

For analytical/SQL projects the "evidence" is a query result or visualisation. For ML projects it's a results table with Dice scores or equivalent metrics. The pattern is the same.

### Non-obvious decisions section

A dedicated section explaining choices that aren't self-evident from the output. The format is consistent:

- **Decision title** as a short bold label (no colon after it)
- A paragraph explaining what was decided and why, with the practical consequence of having done it that way

The emphasis is always on the WHY. A decision section that only says what was done without explaining why is not useful.

---

## How to Explain Technical Concepts

Explain mechanisms, not just names. Don't assume the reader knows what an attention gate does — explain it:

> *"The decoder generates a gating signal at each resolution level and compares it to the encoder's features. Where they agree (this looks like tumour), the gate opens. Where they don't, it closes."*

Then connect it to why it matters for this specific problem:

> *"ET was the region I expected to benefit most. It's compact, has irregular boundaries, and is hardest to distinguish from surrounding tissue."*

Use bold inline to emphasise key terms on first use. Don't use headers for every sub-concept — flowing prose with bolded terms is often cleaner.

For equations, introduce them with a sentence first. Follow with a small table explaining each term if the equation needs it (see the Dice coefficient section on the page).

---

## Engineering Decisions Format

The engineering decisions section uses a consistent structure:

- **Title** (bold, no colon after it — the title is the label, the paragraph is the explanation)
- One or two paragraphs explaining the decision and the reason
- Honest about what would change it: *"I didn't find a reason to change it."*

The explanations emphasise the WHY: why was this the right call given the constraints? Include the practical consequence of not having done it.

> *"NIfTI loading via nibabel is roughly 100× slower than loading a numpy array. Since every training run iterates over 150 cases per epoch for 100 epochs, that overhead adds up fast... It's the kind of thing that seems like an optimisation detail but actually changes what's practical to experiment with."*

---

## Captions

Do not sure `·` as separator if possible, use <->, or -> or just - or find a different way to frame is using sentances .

---

## What's Next Section

Honest and personal. Not a formal roadmap. Includes things that are genuinely unfinished:

> *"HD95 is partially implemented in the codebase but never made it into the final evaluation run."*

Uses first person for things the author is personally curious about:

> *"It's the one I'm most curious about."*

Includes at least one "stretch goal" that is ambitious and speculative but grounded in real possibility.

---

## Code Style

### Docstrings

Multi-line docstrings indent content 4 spaces inside, with the closing `"""` on its own line at base indentation:

```python
class Foo:
    """
        Description here.
        Second line here.
    """
```

Short single-line docstrings go inline:

```python
def bar(self):
    """Does one simple thing."""
```

Though you can do the first type when you might "think" that you will do multiline but end up using a single line, 
so in the end do multiline sometimes when you should have done a single line as well. 

Never put multi-line content on the same line as the opening `"""`.

No `Args:` / `Returns:` / `Raises:` sections. Explain parameters inline in the description if they need explanation.

Tone in docstrings is direct and personal. Incomplete sentences are fine. Comment on WHY, not WHAT:

```python
"""
    Dataset that loads pre-processed float16 numpy arrays instead of NIfTI files.
    About 100x faster than loading NIfTI on every epoch.
    !Run scripts/preprocess_npy.py once to generate the cache before training.
"""
```

Module-level docstrings (file headers) are a single line or multi-line description at the top, often including the paper citation:

```python
"""3D U-Net — Çiçek et al. 2016 (arXiv:1606.06650)"""
```

### Comments

One space between code and comment, not two:

```python
x = self.pool(x) # save encoder output before pooling
```

`#!` for important warnings or flags that need attention:

```python
#! BatchNorm statistics are unreliable with a single sample per batch
#! needed bcs MONAI transforms can return lists
```

`#?` for questions or things to revisit/verify

```python
#? Would this really work this way?
#? Wonder if we can ommit this variable altogether. 
```

`#TODO:` for deferred improvements:

```python
#TODO: try this with a higher pos ratio (e.g. pos=2, neg=1) to show the model more tumour.
```

Regular comments are casual and notes-for-yourself, not documentation-for-others:

```python
# fallback - load from NIfTI directly (much slower)
# seed+1 so val sampling uses different ordering than train
# for faster GPU transfer
```

### No alignment spaces

Never pad variable names, dict keys, or assignments with spaces to align `=` signs:

```python
# wrong
self.kab  = BernsteinActivation(...)
self.kas  = BSplineActivation(...)

# right
self.kab = BernsteinActivation(...)
self.kas = BSplineActivation(...)
```

Same rule applies to dict literals, function parameters, and module-level variables.

### Type hints

Use them on function signatures, especially for public-facing functions. Not required on every internal helper, but consistent on class `__init__` and key methods.

### Registry pattern for configs

Models and losses are registered in plain dicts at module level (`_MODELS`, `_LOSSES`), keyed by config name strings. Keeps config-driven dispatch clean and readable.

---

## SQL Style

All SQL keywords, function names, and operators in **lowercase**. Never uppercase `SELECT`, `FROM`, `WHERE`, etc.

Indentation uses tabs. The `select` keyword sits at one indent level; the column list sits at a second indent level. Joins, `where`, `group by`, `order by`, and `having` all sit at the same level as `select`.

```sql
select
    date_trunc('month', o.order_purchase_timestamp)::date as month,
    round(sum(oi.price)::numeric, 2) as revenue
from orders o
join order_items oi on oi.order_id = o.order_id
where o.order_purchase_timestamp is not null
group by 1
order by 1
```

Each selected column on its own line. Commas at the start of the line are not used — trailing commas on the previous line are fine, but the cleaner pattern is one column per line with no leading comma.

Table aliases are short (one or two letters matching the table name). Column aliases use `as`, lowercase.

Subqueries indent one level in relative to the surrounding query:

```sql
select
    u.user_id,
    u.email,
    orders.total_orders
from users u
left join (
    select
        customer_id,
        count(*) as total_orders
    from orders
    group by 1
) orders on orders.customer_id = u.user_id
```

CTEs follow the same pattern, with the `with` keyword unindented and each CTE body indented:

```sql
with monthly_revenue as (
    select
        date_trunc('month', order_purchase_timestamp)::date as month,
        round(sum(price)::numeric, 2) as revenue
    from orders
    group by 1
)
select *
from monthly_revenue
order by month
```

No uppercase anywhere in SQL.

### No alignment of `as` aliases

Never pad column expressions with spaces to line up the `as` keyword. This is the SQL equivalent of the no-alignment-spaces rule in Python code.

```sql
-- wrong
select
    count(*)                                      as total_orders,
    round(avg(op.payment_value)::numeric, 2)      as avg_order_value,
    count(distinct o.customer_id)                 as unique_customers

-- right
select
    count(*) as total_orders,
    round(avg(op.payment_value)::numeric, 2) as avg_order_value,
    count(distinct o.customer_id) as unique_customers
```

Same rule applies inside CTEs, subqueries, and window function expressions. One space before `as`, no exceptions.

### SQL Comments

Same marker system as Python comments: `--!` for important findings or warnings, `--?` for questions or uncertainty, `--TODO:` for deferred work.

```sql
--! ~3% repeat rate, surprisingly low, most ecommerce platforms run 20-40%
--? not sure if it's product quality or delivery issues, probably both
--TODO: rewrite filtered to SP sellers only
```

Comment text is **all-lowercase**, including when referencing SQL constructs. Keywords like `rank`, `filter`, `distinct on`, `not in`, `group by`, `left join`, `cte`, `explain` stay lowercase when mentioned in comments — the same "no uppercase in SQL" rule applies to prose about SQL, not just SQL itself.

```sql
-- rank: ties get same rank, next position skips (1,1,3)
-- dense_rank: ties get same rank, no skip (1,1,2)
-- for top-n filtering use dense_rank — rank can skip positions and miss rows
```

Each query has a numbered title line followed by a one-line intent comment explaining WHY it was written:

```sql
-- 7. total revenue
-- simplest possible question: how much money moved through this platform
```

Result comments after the query note the actual finding, honest uncertainty, or what the result meant for the next step. Keep them short and observational, not reference-style definitions:

```sql
-- 97% delivered, which seems like a good number for a marketplace this size
-- though i dont really have a frame of reference to compare it to
```

The voice in SQL comments matches the overall voice in the rest of the project — casual, first person, honest about what was surprising or unclear. "prob", "dont" without apostrophe, lowercase "i" are all fine here.

---

## What NOT to Do

- No em dashes in prose or regular comments (`-` or a new sentence instead)
- No alignment spaces anywhere
- No formal `Args:` / `Returns:` sections in docstrings
- No overly structured multi-paragraph block comments unless the file genuinely needs it
- No self-referential meta comments about the project ("this was added for X flow", "used by Y")
- No hedging that buries the result: lead with the finding, add context after
- No formal academic register in portfolio prose
- No semicolons when two sentences work better
- No bullets when prose flows naturally
- No uppercase SQL keywords in comment text (`rank` not `RANK`, `filter` not `FILTER`)
- No reference/documentation-style comment blocks in SQL — personal and observational, not encyclopedic