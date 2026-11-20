# Maths typing repair — 19 Nov 2026

40 questions repaired, 34 of them now print completely clean. 17 were kept out of papers before and can be used again.

Every change only moves a `$`, a brace, a backslash or a line break: the words and the maths are character-for-character the same. Each was checked through the paper's own rendering before it was written, written through the Question Bank's safe fix path and read back.

- Full rows before the change: `maths-repair-2026-11-19.backup.json`
- Undo all of it: `node scripts/question_bank_maths_repair.js ../docs/data/backups/maths-repair-2026-11-19.plan.json --backup ../docs/data/backups/maths-repair-2026-11-19.backup.json --undo`

Solutions marked *(already cut off)* end mid-way in the bank ("Thus," with the working missing); the repair only removed the empty `$$` that printed as code. The missing working still has to be typed in.

| # | Bank | Question id | Part | What was wrong | Before | After |
|---|---|---|---|---|---|---|
| 1 | math_11 | `81b6c8bb-07c5-4d0e-9cec-0b3590f943d5` | solution | empty $$ left before the end / an image *(already cut off)* | `eta⏎=⏎\frac{p^2-1}{2}.⏎$$⏎Substituting,⏎$$⏎[QBP_DIFFICULTY:Medi` | `eta⏎=⏎\frac{p^2-1}{2}.⏎$$⏎Substituting,⏎[QBP_DIFFICULTY:Medi` |
| 2 | math_11 | `82018948-9279-4c30-91c1-be6dc707e8bc` | question | bracket typed outside the maths | `For $f(x)=7x^3-4x+1$, the value of $f'(2$)$ is:` | `For $f(x)=7x^3-4x+1$, the value of $f'(2)$ is:` |
| 3 | math_11 | `6b08e88b-1100-4196-966c-b7c99724a479` | question | bracket typed outside the maths | `f(x)=3x^4-5x^2+7x-2$, the value of $f'(1$)$ is:` | `f(x)=3x^4-5x^2+7x-2$, the value of $f'(1)$ is:` |
| 4 | math_11 | `301209e1-2ee3-4342-8644-ff19fd6a890e` | question | bracket typed outside the maths | `$f(x)=2x^5-3x^3+4x$, the value of $f'(-1$)$ is:` | `$f(x)=2x^5-3x^3+4x$, the value of $f'(-1)$ is:` |
| 5 | math_11 | `2bbcbf6f-533d-44d5-91c8-06f307389450` | question | bracket typed outside the maths | `f(x)=4x^3-7x^2+2x-5$, the value of $f'(2$)$ is:` | `f(x)=4x^3-7x^2+2x-5$, the value of $f'(2)$ is:` |
| 6 | math_11 | `aea9e230-aef6-49c7-b27c-501dc309d060` | question | bracket typed outside the maths | `(x)=5x^3-2x^2+3x+1$, the value of $f'(-1$)$ is:` | `(x)=5x^3-2x^2+3x+1$, the value of $f'(-1)$ is:` |
| 7 | math_11 | `e45c9d37-f32f-4ad6-b75e-6ad8924fa35a` | question | bracket typed outside the maths | `r $f(x)=6x^4+x^2-3x$, the value of $f'(2$)$ is:` | `r $f(x)=6x^4+x^2-3x$, the value of $f'(2)$ is:` |
| 8 | math_11 | `cc5cd0d0-bcf6-4aae-b4dd-f39569a35d11` | question | bracket typed outside the maths | `or $f(x)=x^5+2x^3-x$, the value of $f'(1$)$ is:` | `or $f(x)=x^5+2x^3-x$, the value of $f'(1)$ is:` |
| 9 | math_11 | `aa67419d-f9d1-4d06-8e7b-2fbdfd484b2a` | question | bracket typed outside the maths | `r $f(x)=3x^4+2x^2-5$, the value of $f'(1$)$ is:` | `r $f(x)=3x^4+2x^2-5$, the value of $f'(1)$ is:` |
| 10 | math_11 | `57144a42-318a-4b20-a1f7-e86ad7cccede` | question | bracket typed outside the maths | `(x)=\sin3x$, determine $f'(\frac{\pi}{6}$)$.` | `(x)=\sin3x$, determine $f'(\frac{\pi}{6})$.` |
| 11 | math_11 | `a4525d4d-3b5e-40cc-b4bd-831205791d93` | question | bracket typed outside the maths | `(x)=\cos4x$, determine $f'(\frac{\pi}{8}$)$.` | `(x)=\cos4x$, determine $f'(\frac{\pi}{8})$.` |
| 12 | math_11 | `bc2fec83-ab7e-475e-ae69-1f352c04f74b` | question | bracket typed outside the maths | `or $f(x)=\sin5x+\cos2x$, determine $f'(0$)$.` | `or $f(x)=\sin5x+\cos2x$, determine $f'(0)$.` |
| 13 | math_11 | `25e2aca5-0c15-4833-acd0-fa3b87ed9808` | question | bracket typed outside the maths | ` $f(x)=2\sin x-3\cos x$, determine $f'(0$)$.` | ` $f(x)=2\sin x-3\cos x$, determine $f'(0)$.` |
| 14 | math_11 | `c82b0680-a959-4942-bc35-fa3c862936d1` | question | bracket typed outside the maths | `n x+\cos x$, determine $f'(\frac{\pi}{4}$)$.` | `n x+\cos x$, determine $f'(\frac{\pi}{4})$.` |
| 15 | math_11 | `c6016386-1450-461b-9092-041aea5faf5c` | question | bracket typed outside the maths | `s x+\sin2x$, determine $f'(\frac{\pi}{2}$)$.` | `s x+\sin2x$, determine $f'(\frac{\pi}{2})$.` |
| 16 | math_12 | `266afa10-df4a-40ef-b82a-11bc94373caf` | solution | empty $$ left before the end / an image *(already cut off)* | `{3+4+5}⏎=⏎\frac14.⏎$$⏎For a green ball,⏎$$⏎[QBP_DIFFICULTY:Medi` | `{3+4+5}⏎=⏎\frac14.⏎$$⏎For a green ball,⏎[QBP_DIFFICULTY:Medi` |
| 17 | math_12 | `3387fdce-e287-4b23-8395-365e5e9ddc0c` | solution | empty $$ left before the end / an image | ` \ell^2 = 2^2 + 2^2 = 4 + 4 = \mathbf{8}$$⏎[QBP_DIFFICULTY:Har` | ` \ell^2 = 2^2 + 2^2 = 4 + 4 = \mathbf{8}⏎[QBP_DIFFICULTY:Har` |
| 18 | math_12 | `ed853bb8-24de-455e-83ee-382b4ae4e201` | solution | empty $$ left before the end / an image *(already cut off)* | `must fail and then $B$ must fail.⏎Thus,⏎$$⏎[QBP_DIFFICULTY:Hard` | `must fail and then $B$ must fail.⏎Thus,⏎[QBP_DIFFICULTY:Hard` |
| 19 | math_12 | `9e6d6738-732e-4ec0-87e3-e80e7a7604d2` | solution | empty $$ left before the end / an image *(already cut off)* | `\frac{\pi}{2}⏎+1-4+1⏎=⏎-\pi-2.⏎$$⏎Also,⏎$$⏎[QBP_DIFFICULTY:Hard` | `\frac{\pi}{2}⏎+1-4+1⏎=⏎-\pi-2.⏎$$⏎Also,⏎[QBP_DIFFICULTY:Hard` |
| 20 | math_12 | `bea7e480-b092-4f0a-8e8c-d061076f082a` | solution | empty $$ left before the end / an image *(already cut off)* | `um occurs at $x=1$:⏎$$⏎q=f(1).⏎$$⏎Thus,⏎$$⏎[QBP_DIFFICULTY:Hard` | `um occurs at $x=1$:⏎$$⏎q=f(1).⏎$$⏎Thus,⏎[QBP_DIFFICULTY:Hard` |
| 21 | chem_11 | `730d245c-e983-4de2-97ee-6fe75e950050` | solution | brace left open | `of moles. A further $0.01\,\mathrm{{mol}$ is added:⏎$$⏎n_{\t` | `of moles. A further $0.01\,\mathrm{{mol}}$ is added:⏎$$⏎n_{\t` |
| 22 | chem_11 | `82967c31-e69a-4c49-bc00-6b8766bc9116` | solution | empty $$ left before the end / an image | `ves $a - x = x$, so $x = \dfrac{a}{2}$.⏎$$⏎[QBP_DIFFICULTY:Medi` | `ves $a - x = x$, so $x = \dfrac{a}{2}$.⏎[QBP_DIFFICULTY:Medi` |
| 23 | chem_11 | `51bff08b-568e-478f-93bc-4ac149017d27` | question | backslash typed for a slash | `Which of the following molecule\ion does not contain` | `Which of the following molecule/ion does not contain` |
| 24 | chem_11 | `39a923a2-d5de-469a-ac94-29a950de9d52` | solution | empty $$ left before the end / an image | `cular hydrogen bonds and boils highest.⏎$$⏎[QBP_DIFFICULTY:Medi` | `cular hydrogen bonds and boils highest.⏎[QBP_DIFFICULTY:Medi` |
| 25 | chem_11 | `9c7351be-c330-4af3-b781-0417bbda6954` | solution | empty $$ left before the end / an image | `sertion.⏎Therefore, option D is correct.$$⏎[QBP_DIFFICULTY:Med` | `sertion.⏎Therefore, option D is correct.⏎[QBP_DIFFICULTY:Med` |
| 26 | chem_11 | `cf25b9d9-60cd-4fdc-8b2b-0c21302ab14c` | solution | empty $$ left before the end / an image *(already cut off)* | `ance.⏎Applying this to the given salts:⏎$$⏎[QBP_DIFFICULTY:Medi` | `ance.⏎Applying this to the given salts:⏎[QBP_DIFFICULTY:Medi` |
| 27 | chem_11 | `6dbfa58a-aa78-4b03-88a0-7507b157f5e1` | solution | empty $$ left before the end / an image *(already cut off)* | `ast dense.⏎Ranking the given compounds:⏎$$⏎[QBP_DIFFICULTY:Medi` | `ast dense.⏎Ranking the given compounds:⏎[QBP_DIFFICULTY:Medi` |
| 28 | chem_11 | `73d4f684-c827-446d-9299-bd6204764580` | solution | empty $$ left before the end / an image *(already cut off)* | `increasing order of $\alpha$-H acidity:⏎$$⏎[QBP_DIFFICULTY:Hard` | `increasing order of $\alpha$-H acidity:⏎[QBP_DIFFICULTY:Hard` |
| 29 | chem_11 | `bba3889e-3a9c-4b5c-942e-a6dd73caba66` | solution | empty $$ left before the end / an image | `ome stabilisation, and A has the least.⏎$$⏎[QBP_DIFFICULTY:Medi` | `ome stabilisation, and A has the least.⏎[QBP_DIFFICULTY:Medi` |
| 30 | chem_11 | `0add7969-5cb9-49fa-bd5f-077afd54a221` | solution | empty $$ left before the end / an image *(already cut off)* | `nucleophiles from weakest to strongest:⏎$$⏎[QBP_DIFFICULTY:Medi` | `nucleophiles from weakest to strongest:⏎[QBP_DIFFICULTY:Medi` |
| 31 | chem_12 | `740a6da6-45f2-426e-a5a9-d335202fbbcf` | question | brace left open | `f pairs among $\mathrm{{[NiCl_{4}]^{2-}}$, $\mathrm{[Ni(CO)_{4}]}}$, $\mathrm{{[NiCl_{4}]^{2-}}$, $\mathrm{[Ni(CN)_{4}]^{2-}}}$ and $\mathrm{{[Ni(CO)_{4}]}$, $\mathrm{[Ni(CN)` | `f pairs among $\mathrm{{[NiCl_{4}]^{2-}}}$, $\mathrm{[Ni(CO)_{4}]}}$, $\mathrm{{[NiCl_{4}]^{2-}}}$, $\mathrm{[Ni(CN)_{4}]^{2-}}}$ and $\mathrm{{[Ni(CO)_{4}]}}$, $\mathrm{[Ni(CN)` |
| 32 | chem_12 | `740a6da6-45f2-426e-a5a9-d335202fbbcf` | solution | brace left open | `c. Only the pair $\mathrm{{[Ni(CO)_{4}]}$, $\mathrm{[Ni(CN)_` | `c. Only the pair $\mathrm{{[Ni(CO)_{4}]}}$, $\mathrm{[Ni(CN)_` |
| 33 | chem_12 | `e6d583e5-6cda-41e1-9add-8339ebd7967f` | question | empty $$ left before the end / an image | `ntify A in the given chemical reaction.⏎$$⏎{{IMG::https://res.` | `ntify A in the given chemical reaction.⏎⏎{{IMG::https://res.` |
| 34 | chem_12 | `9f6852fe-6429-4806-850b-e84b24ef39f8` | question | empty $$ left before the end / an image | `ry amines. Identify reagent (A) and (B)⏎$$⏎{{IMG::https://res.` | `ry amines. Identify reagent (A) and (B)⏎⏎{{IMG::https://res.` |
| 35 | bio_12 | `fa7972d4-c56b-43c2-8a72-5a93806f15b7` | solution | empty $$ left before the end / an image *(already cut off)* | `ng separate, breaking 8 hydrogen bonds:⏎$$⏎[QBP_DIFFICULTY:Hard` | `ng separate, breaking 8 hydrogen bonds:⏎[QBP_DIFFICULTY:Hard` |
| 36 | bio_12 | `53ec8f33-7ca4-4d46-9ffd-5e4c66cfaf2f` | solution | empty $$ left before the end / an image | `quad 8 \times 4 = 32 \text{ cleaved}⏎$$⏎$$⏎[QBP_DIFFICULTY:Hard` | `quad 8 \times 4 = 32 \text{ cleaved}⏎$$⏎[QBP_DIFFICULTY:Hard` |
| 37 | bio_12 | `ce52629b-c9b7-4987-ae31-f1749603542a` | solution | empty $$ left before the end / an image *(already cut off)* | `the binomial coefficients of $(a+b)^6$:⏎$$⏎[QBP_DIFFICULTY:Medi` | `the binomial coefficients of $(a+b)^6$:⏎[QBP_DIFFICULTY:Medi` |
| 38 | bio_12 | `d8acaf45-cf71-45a8-aac4-d0ba52849532` | solution | empty $$ left before the end / an image *(already cut off)* | `enes the F$_2$ ratio follows $(a+b)^6$:⏎$$⏎[QBP_DIFFICULTY:Medi` | `enes the F$_2$ ratio follows $(a+b)^6$:⏎[QBP_DIFFICULTY:Medi` |
| 39 | bio_12 | `e0ff9b41-8d43-49a9-8619-02246a162bc2` | solution | empty $$ left before the end / an image | `additive gene pairs, the F$_2$ ratio is⏎$$⏎[QBP_DIFFICULTY:Medi` | `additive gene pairs, the F$_2$ ratio is⏎[QBP_DIFFICULTY:Medi` |
| 40 | phy_11 | `e0cfc4e7-2405-42df-b8bb-05cd8036fc36` | solution | brace left open | ` rises from $3\ \text{m}$ to $4\ \text{m$. Hence, its vertic` | ` rises from $3\ \text{m}$ to $4\ \text{m}$. Hence, its vertic` |
| 41 | phy_12 | `7d9d5df4-0904-4e77-9b5e-0164c8d0bd89` | solution | empty $$ left before the end / an image *(already cut off)* | ` on the capacitor is⏎$$⏎Q=Ce.⏎$$⏎Hence,⏎$$⏎[QBP_DIFFICULTY:Medi` | ` on the capacitor is⏎$$⏎Q=Ce.⏎$$⏎Hence,⏎[QBP_DIFFICULTY:Medi` |

## Not repaired (92) — need the source text

These have equations that are cut off, options with solution text glued into them, or missing parts. They stay on the Question Bank's "Needs fixing" list.

| Bank | Question id | Problem |
|---|---|---|
| math_11 | `10f27106-8b61-43e0-b4ee-ebb449dadaab` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `11d3a578-be04-4677-af3d-a6fc13061b40` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `2d4ea43b-180e-4142-a0ee-9652c6e1a657` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `3d914e33-95e8-47ce-83b3-e061c88cc9e0` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `43915795-4585-4255-b34b-f8efaba1e733` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `44a08514-7b3d-463c-915b-e2f8b786641b` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `80eb94cb-6e84-457b-8a9d-9d28f16586be` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_11 | `b3908de6-bd13-44de-838a-c8b845253122` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `ebefd33c-c851-462c-91ee-b8ddf8698c45` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_11 | `5bb87572-8e3e-4bd2-8f1d-10333f9e4073` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `61aa6b9b-760f-4f40-af3c-5934be9c11e7` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `75ecfa2e-a0b7-4cdb-9fa0-7386561f2b7b` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `0b1ae6fd-76f5-4c48-86f3-cde25bdeb601` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `37a1e5bc-319c-440d-8e5c-22cf75efb044` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `fe0d9cd1-bb20-464e-b2a9-f6203000d4e2` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `3d59c7e1-7477-4bd6-873b-5a7e02f78e81` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_11 | `6f470dac-b417-4d8f-bd23-df96456dce14` | assertion: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `0412f560-2fc5-40ab-98ab-ff99eb53f4a6` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `086e5482-9b41-48d3-8969-b440a123c617` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `0bd36104-7785-40ab-af38-59589c3091e1` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `0cc3ad7e-600a-48b2-a2a8-6edf3d506adb` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `0f1c2ed9-ab17-47aa-bef9-c52dc3eeac8d` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `1ce1e72d-a936-4e6b-b3e5-209aa7ccb564` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `1fd0b2bc-1204-494e-ae95-286704ab5af3` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `23b8ba81-c859-4c9e-873e-eb42376c4beb` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `29749e6b-ab4f-4191-897e-ce9d2a59a578` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `2b44bc62-c5c7-4a1e-a7ba-3dfe91e81cae` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `2f2624df-c6cf-46a5-8280-82e07edae393` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `3dff6e0c-eff3-49f7-b8c0-f181cd67638c` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `40335600-a52f-4f5e-b98d-a1d816fd8271` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `41776e6b-ce12-410f-bda4-282047507004` | column I item 1: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `4c6b42b1-ebe9-464e-ab13-416006c6c105` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `4edab354-cf88-4736-99d3-562b6ff0d1aa` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `50acf01a-959a-465e-9093-49915b5f3aab` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `5458b4c4-be76-4cf4-b8f9-3d62ecc0dc41` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `5559ce71-d05b-43f4-8e56-92b92791253d` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `560137ee-8242-448d-9d82-bc3e4d307936` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `580800e5-9280-4493-b98a-b3c2e22a06c3` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `6633aea1-b0a0-4f67-9b2e-34198146d1a2` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `6bcba552-f2fc-4a40-a0e0-9abff6074d36` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `6de330cf-d852-434c-9ba5-cf18aaf275ce` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `70a9a00b-5c6a-4992-8a51-a9c118283a5d` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `74378aaa-8731-4b36-ada4-7437bf38e39a` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `759c91cf-c2b0-443c-9c6e-11fca4059b23` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `7f954a53-38c8-4649-93b8-0ac2bc552b4e` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `8361e821-0989-48cb-929a-86ca0103522a` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `838454bd-0f2c-487d-8a2b-7c1ec5983d36` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `9119ecc4-3116-49ae-87cb-88d35a6bf938` | column I item 4: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `92c37834-c395-4cdb-81db-af1a69aba3c9` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `97de2e8d-e694-410e-b980-55792a4e00bd` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `a4056c47-36c1-488a-8aed-c572e62d52fe` | option 2: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `aca58718-117f-46f0-a44f-f9b8c2292725` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `b24a547e-e099-4d2e-8c3f-ee317f4560aa` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `b6c89c1d-43e6-4f3c-a7c9-f1bcdb670cf5` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `bbff0af2-eec0-4bd8-bbe0-34c9ebeea731` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `bd793b7b-3c06-4b96-a25d-53b7165cd257` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `c0821fe4-88bc-41e3-b79e-10e5787e35eb` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `c638ad3f-1f37-40a3-a293-a1189a6bfb2b` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `c9c6bd28-ca3c-4583-b2ce-3366463dd97d` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `cc1a3429-b216-4f27-8409-8fabaf326d6d` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `d434e272-7915-4c25-8a8b-ed99ed53ade5` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `ea2b4d3e-9e45-4616-b03e-bed1cbd09a47` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `ea3dbd3e-f3ba-4db1-a635-2abdbebd9d55` | assertion: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| math_12 | `efa6bcbf-3845-41e4-a7d9-e657c0c64ddb` | column I item 3: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `fd474dd4-ba1e-4b30-afb4-07a2312e9268` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `543330ca-a82e-4302-ba86-4a82f27e4498` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| math_12 | `3a832b60-9b64-46b7-a73e-27881d489958` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| chem_11 | `d143190d-3780-46d0-bfe4-55cf8eeaa26f` | column II item 2: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| chem_11 | `5aca6aa1-5b6f-4697-8972-9eca74b9eafd` | column I item 4: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| chem_11 | `6d8d0a7a-8034-4e89-9a7a-685e5641b848` | column II item 2: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| chem_11 | `9d4440b3-6a71-4aae-9d34-5848a3a14c48` | column I item 4: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| chem_11 | `9eb0abee-84b3-4fc7-8d31-0e2c0a55856a` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| chem_11 | `e45aa3e8-4dea-412d-8e42-4d01f9279253` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| chem_12 | `cfd77d79-926b-4c7b-9b52-e0045b197f0a` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| chem_12 | `27bcfaef-26cc-4bdc-81d3-23fff6723c80` | column I item 3: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| bio_11 | `13889afd-416c-4620-bcd9-9fce1c09f487` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| bio_12 | `e64cf115-875f-430a-bf36-00af5d4c69ee` | question: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| bio_12 | `184702b0-3a9e-4d6f-99b5-337fefdc5dd5` | option 1: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| bio_12 | `a1d743ae-96da-42d9-a18e-714238fcf1b9` | option 1: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| bio_12 | `c9e18d74-cf8d-4df6-84f9-140782856262` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| bio_12 | `74fc1f9e-914c-4b2f-8739-76a7930b4b09` | question: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_11 | `83efa9fb-f3d7-46f0-ac56-a22e21e7472e` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_11 | `b845e9c7-a42b-4d5f-9f88-f6b7912c9770` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_11 | `d7185c9e-5118-4c52-934f-a438a80b00af` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_11 | `2d974b49-0204-4262-a455-0200279fb5a7` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| phy_11 | `41b43d4b-5b88-4056-b2a0-f0051d41ba75` | solution: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| phy_11 | `4fe19b9c-0135-47ee-8854-d3baee687930` | reason: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_11 | `f1dfafcc-9d0e-4f40-b51f-00a3b0cdef9f` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_12 | `34c9ea06-7188-4bd6-a2aa-87ece4ed4dab` | option 1: The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text. |
| phy_12 | `ac8f913a-da25-4465-94ee-d301110cfa9f` | assertion: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_12 | `e417d9c4-e253-4f1b-839b-ddee87434051` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
| phy_12 | `ebd6fe6b-8c67-4deb-8bd2-d4f426911f5e` | solution: Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation). |
