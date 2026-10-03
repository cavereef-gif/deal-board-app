# Proposal – one check list per side (Trust check + the deal-row checks)

Status: **proposed only – not built.** Chris (3 Oct 2026): "Overlap with the Trust check: do not build. Write a short proposal for merging the two lists, then stop."

## The problem
A mineral deal now has two lists that ask about the same buyer and stockpile:
- **Trust check** on the deal page (28 Sep): Buyer 5 lines, Stockpile 6 lines, Red flags 4.
- **Checks** behind the Buyer · Stockpile · Funds dots on the Deals list (3 Oct): Buyer 4, Stockpile 3, Funds 2.

Two lines are already shared (company on CIPC; proof of ownership). The rest differ, so the same deal can read "Buyer verified" on the row and "buyer 2/5" on the deal page. That is confusing and doubles the ticking.

## The proposal
One list per side, used in both places (the deal page and the panel behind each dot). The dot reads "verified" when every **must** line is ticked. The step (Buyer checked / Stockpile checked) ticks itself at that moment, as the Trust check already does. It is still a person's tap, never the bot.

**Buyer** (must, unless marked "if you can")
1. Company found on CIPC – name, number, directors *(both lists today)*
2. A director's ID seen *(dots)*
3. The person signing is a director or has a signed mandate *(Trust check)*
4. Phone and email confirmed on our own – not from their letter *(dots)*
5. Not on our Do not deal list – the app compares the name and says what it found *(dots)*
6. References or past trades checked – if you can *(Trust check)*
7. We have dealt with them before – if you can *(Trust check)*

**Stockpile**
1. Seller's company found on CIPC *(Trust check)*
2. Mining right or permit seen, with its number *(Trust check)*
3. Proof of ownership, or a mandate, seen *(both lists today)*
4. Dated site photos *(dots; replaces half of "site visit or dated photos")*
5. Location confirmed – a map pin or the address *(dots; the other half)*
6. Seller's own assay seen – if you can *(Trust check)*
7. Access agreed for the buyer's sampling – if you can *(Trust check)*

**Funds**
1. Proof of funds seen (the line shows what Docs says)
2. How it was verified – "only saw the letter" does not count
- The Trust check's "Their bank confirmed them – we phoned the bank's own number" moves here as one of the answers to line 2.

**Red flags** stay as they are (deal page). New: a red flag also shows on the row as a coral dot with the words "red flag".

## What carries over
- No database change. Everything stays in the deal's own check data (`params._trust`), and ticks already made are kept.
- An old "site visit or dated photos" tick counts as both line 4 and line 5 until someone unticks one.
- An old "bank confirmed" tick fills Funds line 2 only if Funds is still empty.

## Decisions for Chris
1. Is the must / "if you can" split above right? This decides when a dot says "verified".
2. Should the bank line move to Funds, or stay under Buyer as well?
3. Should a verified Funds dot tick the "Proof of funds" step? Today that step ticks when the document is marked Received in Docs.

## Cost and size
R0. About one small batch: lean.js (the list), flow.js (the dots read it), and the tests. It does not block any step. Blocking gates are a separate approval.
