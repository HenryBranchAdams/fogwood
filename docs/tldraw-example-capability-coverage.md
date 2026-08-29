# tldraw example capability coverage

This matrix reports the 213 pinned examples by adapter family. The columns are
deliberately separate: an example may be searchable and routable without being
an exact local equivalent, ready in the observed host, staged through the
proposal lifecycle, or successfully applied.

| Adapter family | Routes | Searchable | Routable | Local equivalence | Host ready | Stage fixture | Success fixture |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| native canvas | 13 | 13/13 | 13/13 | 3 exact; 10 bounded-family | local | exact fixtures only | exact fixtures only |
| local material / artifact | 9 | 9/9 | 9/9 | bounded bridge | local decoder-dependent | bridge fixtures | bridge fixtures |
| editor introspection | 4 | 4/4 | 4/4 | bounded read projection | local | not applicable | read fixtures |
| control plane | 70 | 70/70 | 70/70 | 2 exact semantic lowerers; 68 bounded-family | local for installed lowerers | page + camera | page + camera |
| extension / compound | 81 | 81/81 | 81/81 | bounded-family | extension-dependent | none claimed | none claimed |
| local persistence | 6 | 6/6 | 6/6 | bounded persistence seam | local | not applicable | persistence fixtures |
| collaboration / identity | 20 | 20/20 | 20/20 | none local | requires observed host | none claimed | none claimed |
| external active content | 10 | 10/10 | 10/10 | sanitized artifact return only | requires observed capability | artifact fixtures only | artifact fixtures only |
| **Total** | **213** | **213/213** | **213/213** | **5 exact local fixtures, 178 bounded/mediated routes, 30 host-mediated routes** | **not a blanket claim** | **family-specific only** | **family-specific only** |

The route compiler remains authoritative for the ordered 213-entry identity,
the eight family counts, and the fidelity totals. Its current baseline is 3
exact route fixtures, 180 bounded-native-equivalent routes, and 30
host-mediated routes. The two exact semantic lowerers deepen two control-plane
routes without relabeling the upstream examples or claiming their source code
ran. Live host readiness is always observed just in time and never inferred
from this file.
