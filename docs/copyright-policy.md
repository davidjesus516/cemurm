# CEMURM — Copyright Policy Analysis

*Prepared for legal review*

---

## 1. Overview of Copyright Challenges

CEMURM is a platform where musicians store, share, and collaborate on song arrangements. This creates several copyright considerations:

- **User-uploaded content** may include copyrighted lyrics, chord progressions, or full musical arrangements
- **Community contributions** require clear licensing terms
- **Third-party content** (from IMSLP, Wikifonia, public domain sources) must be properly attributed
- **API integrations** (LRCLIB, MusicBrainz, Spotify) have their own usage terms

The platform must balance openness for community contribution with respect for intellectual property rights.

---

## 2. User-Generated Content (UGC) Safe Harbor

### DMCA Section 512 Compliance

CEMURM should qualify for **safe harbor protection** under DMCA Section 512 if it:

 1. **Designates a DMCA agent** with the U.S. Copyright Office
 2. **Implements a takedown process**: removes infringing content upon receiving a valid DMCA notice
 3. **Adopts a repeat infringer policy**: in appropriate circumstances, terminates the accounts of subscribers who are repeat infringers (see below)
 4. **Does not have actual knowledge** of infringing activity on the platform

### Recommended Actions
- Register a DMCA agent with the Copyright Office (fee: ~$6 per designation, valid 3 years)
- Build a takedown request form in the app (admin-facing)
- Maintain a log of takedown notices and counter-notices (stored per-notice in the `dmca_notices` table — see `docs/database-schema-v2.md` §2)
- Draft a repeat infringer policy in the Terms of Service

### Repeat Infringer Policy

To qualify for safe harbor under DMCA §512(i)(1)(A), CEMURM must adopt and reasonably implement a policy that **provides for the termination of repeat infringers** — i.e., CEMURM "in appropriate circumstances, terminates the accounts of subscribers who are repeat infringers." This standard safe-harbor language is required and is retained in the Terms of Service.

The MVP enforcement mechanism (matching the schema's actual capability) is escalating:

1. **Rate-limiting**: after confirmed violations, the contributor is rate-limited via `rating_restrictions` (blocking further public contributions until `restricted_until`).
2. **Suspension pending review**: after **N confirmed violations** (threshold admin-configurable), the account is **suspended** pending manual admin review. Suspension is not automatic termination — an admin reviews the case (`moderation_cases`) before any final action.
3. **Termination**: applies "in appropriate circumstances" as required by §512(i)(1)(A), and in practice only after an admin confirms on review that the threshold for termination is met.

This keeps the legally-required termination policy in force while aligning the day-to-day mechanism with what the MVP schema supports: escalating rate-limiting, then suspension pending review, rather than unconditional auto-termination. The suspension threshold and the decision to terminate remain admin-configurable, not a hard-coded app default.

### Limitations
- Safe harbor does NOT apply if the platform **actively curates or promotes** infringing content
- If CEMURM creates editorial collections that include infringing songs, it could lose safe harbor protection for those collections
- The "knowledge" standard is actual knowledge, not constructive — but once notified, the platform must act promptly

---

## 3. Creative Commons Licensing

### Recommended Approach for Community Contributions

When users contribute songs to the public library, they should select a license:

| License | Permissions | Requirements | Suitable For |
|---------|-------------|-------------|-------------|
| CC0 (Public Domain) | Unlimited use | None | Truly original work, public domain arrangements |
| CC-BY-4.0 | Share, adapt, commercial use | Attribution | Most community contributions |
| CC-BY-SA-4.0 | Share, adapt, commercial use | Attribution + ShareAlike | Collaborative/derivative work |
| CC-BY-NC-4.0 | Share, adapt, non-commercial | Attribution | Users who want to restrict commercial use |
| CC-BY-NC-SA-4.0 | Share, adapt, non-commercial | Attribution + ShareAlike | Maximum protection for non-commercial |
| Proprietary | View only (on CEMURM) | Platform ToS | Arrangements the user wants to keep on-platform |

### Implementation
- License selector on song creation (dropdown with clear explanations)
- License displayed prominently on each song in the public library
- License metadata embedded in exported files
- Default to CC-BY-4.0 for public contributions (balances openness with attribution)

---

## 4. Open Educational Resources (OER) Model

CEMURM's public library can follow OER principles:

- **Free to access**: Anyone can view public domain and CC-licensed songs
- **Free to use**: Musicians can use arrangements in performances
- **Free to adapt**: Transposition, arrangement modifications are derivative works
- **Free to share**: Songs can be shared via link or exported

### OER Best Practices
- Clearly mark each song's license
- Provide attribution templates (auto-generated from metadata)
- Allow "forking" of arrangements (creates a derivative with clear lineage)
- Track provenance (original source, modifications made)

---

## 5. Public Domain Content Strategy

### Sources for Public Domain Bootstrapping

| Source | Content | License | Notes |
|--------|---------|---------|-------|
| IMSLP | Sheet music (compositions pre-1927 in US) | Public Domain | Requires manual download, no API |
| Wikifonia | Lead sheets (CC-BY licensed) | CC-BY | Dataset archived; verify license per song |
| Mutopia Project | Classical sheet music | Various PD/CC | Well-organized, machine-readable |
| Kern Scores | Music notation | Public Domain | MusicXML/MEI format |

### Risk Considerations
- **Arrangements vs. compositions**: A J.S. Bach composition is public domain, but a specific modern arrangement may be copyrighted
- **Editions**: Engraved editions (e.g., Henle, Bärenreiter) may have copyright on the *edition* even if the composition is public domain
- **Translations**: Lyrics translations are derivative works and may be copyrighted
- **Country variation**: Public domain rules differ by jurisdiction (life + 70 years in EU, life + 70 in US post-2022)

### Recommended Approach
- Only ingest compositions clearly in the public domain in the US and EU
- Verify each source's license before import
- Require human curation for public library additions (no bulk automated import)
- Display source attribution and license on every song page

---

## 6. Risks of Scraping/Third-Party Content

### High-Risk Activities

| Activity | Risk Level | Why |
|----------|-----------|-----|
| Scraping Ultimate Guitar | **HIGH** | TOS prohibits scraping; actively enforces; potential CFAA liability |
| Scraping Cifra Club | **HIGH** | TOS prohibits scraping; Brazilian copyright law applies |
| Indexing chord sites | **HIGH** | Most sites have explicit anti-scraping TOS |
| Auto-importing from music services | **MEDIUM** | API TOS may prohibit storage/redistribution |

### Legal Risks
- **CFAA (Computer Fraud and Abuse Act)**: Unauthorized access to computer systems
- **TOS violations**: Breach of contract claims
- **Copyright infringement**: Direct liability for reproducing copyrighted content
- **Contributory infringement**: If the platform enables users to access infringing content

### Recommendation
**Do NOT scrape third-party chord/tab sites.** The legal risk outweighs any benefit. Instead:
- Rely on community-contributed content
- Use public domain sources for bootstrapping
- Provide URL import that fetches metadata only (not content) from public APIs
- Allow users to paste their own arrangements (they bear responsibility for copyright)

---

## 7. Recommended Copyright Strategy

### Core Principle
**Community-contributed content + public domain bootstrapping + clear licensing**

### Implementation

1. **Public Library** (curated)
   - Bootstrapped from IMSLP, Mutopia, Kern Scores (public domain)
   - Each song manually reviewed before publishing
   - Clear license and source attribution

2. **User Libraries** (private by default)
   - Users own their content
   - Default: private, only visible to the user
   - Opt-in to share publicly with a chosen license

3. **Community Contributions**
   - Users can submit songs to the public library
   - Must select a license (CC-BY-4.0 recommended)
   - Curated review before publishing (prevents spam/infringement)

4. **No Scraping**
   - Platform does not scrape third-party sites
   - URL import fetches metadata only (artist, title) from public APIs
   - Users paste their own content (they are responsible for copyright compliance)

5. **DMCA Compliance**
   - DMCA agent registered
   - Takedown process built into the app
   - Repeat infringer policy in Terms of Service

---

## 8. EULA / Terms of Service Draft Outline

### Sections to Include

1. **Acceptance of Terms** — User agrees to ToS by using the platform
2. **Description of Service** — What CEMURM is and does
3. **User Accounts** — Registration, responsibilities, termination
4. **User Content** — Ownership, license granted to CEMURM, representation/warranty
5. **Public Content** — How public songs are licensed and shared
6. **Copyright Policy** — DMCA process, takedown procedure, counter-notices
7. **Prohibited Conduct** — No scraping, no infringement, no abuse
8. **Third-Party Services** — API integrations and their terms
9. **Privacy Policy** — Data collection, storage, and usage
10. **Limitation of Liability** — Standard disclaimers
11. **Modifications** — Right to update terms with notice
12. **Governing Law** — Jurisdiction for disputes

### Key Clauses

**User Content License:**
> By uploading content to CEMURM, you retain ownership of your copyright. You grant CEMURM a non-exclusive, worldwide, royalty-free license to store, display, and distribute your content as necessary to provide the service. If you make content public, you choose a Creative Commons license that governs how others may use it.

**User Representation:**
> You represent and warrant that you own or have the necessary rights to all content you upload, and that such content does not infringe the intellectual property rights of any third party.

**DMCA Agent:**
> CEMURM designates the following agent to receive notifications of claimed infringement: [Name, Address, Email, Phone]

---

## 9. Comparison Table: Licensing Models

| Model | Pros | Cons | Best For |
|-------|------|------|----------|
| **All Rights Reserved** | Maximum control, no unauthorized use | Limits community growth, hostile to musicians | Commercial sheet music publishers |
| **CC-BY-4.0** | Open, requires attribution, allows commercial use | Some users uncomfortable with commercial use | Community-driven platforms |
| **CC-BY-NC-4.0** | Protects non-commercial use, still open | Restricts commercial use (hard to enforce) | Educational/non-profit focus |
| **CC-BY-SA-4.0** | Derivatives must be shared alike | Viral license may deter some contributors | Copyleft-style community |
| **Custom ToS + UGC** | Platform controls terms, flexible | More legal complexity, less standard | Social platforms (YouTube model) |
| **Hybrid (Recommended)** | Public library PD, user content CC, private content ToS | Requires clear UI to explain | CEMURM's use case |

### Recommended Hybrid Model for CEMURM

- **Private user content**: Governed by Terms of Service (user owns copyright, grants platform license)
- **Public contributions**: User selects a CC license (CC-BY-4.0 recommended as default)
- **Curated public library**: Public domain compositions, clearly attributed
- **Platform content** (docs, UI): MIT or CC-BY-4.0

---

## 10. Action Items for Legal Team

1. [ ] Review and finalize EULA / Terms of Service
2. [ ] Register DMCA agent with U.S. Copyright Office
3. [ ] Review public domain sources (IMSLP, Mutopia) for import eligibility
4. [ ] Confirm CC license selection UI meets legal requirements
5. [ ] Review Supabase and Cloudflare terms for data handling obligations
6. [ ] Draft privacy policy (GDPR + CCPA compliant)
7. [ ] Assess jurisdiction-specific requirements (EU, Brazil, US)
